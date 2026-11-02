#!/usr/bin/env node

/**
 * pr-comments.mjs
 *
 * Dedicated utility for PR review comment handling in Antigravity workflows (e.g. /auto-code).
 * Provides reliable, cross-platform fetching, replying, and resolving of GitHub PR review threads
 * without needing ad-hoc script generation or fragile shell GraphQL escaping.
 */

import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// --- Normalization & Validation ---

const VALID_REASONS = {
  ADDRESSED: 'ADDRESSED',
  FIXED: 'ADDRESSED',
  RESOLVED: 'ADDRESSED',
  INVALID: 'INVALID',
  INCORRECT: 'INVALID',
  WONT_FIX: 'WONT_FIX',
  WONTFIX: 'WONT_FIX',
  "WON'T FIX": 'WONT_FIX',
  DEFERRED: 'WONT_FIX',
};

export function normalizeReason(input) {
  if (!input) return null;
  const cleaned = input.toString().trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (VALID_REASONS[cleaned]) {
    return VALID_REASONS[cleaned];
  }
  // Try matching with apostrophe removed
  const noApostrophe = cleaned.replace(/'/g, '');
  if (VALID_REASONS[noApostrophe]) {
    return VALID_REASONS[noApostrophe];
  }
  return null;
}

// --- CLI Runner / Gh Wrapper ---

export function runGh(args, { cwd = process.cwd(), env = process.env } = {}) {
  try {
    const stdout = execFileSync('gh', args, {
      cwd,
      env,
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 50 * 1024 * 1024,
    });
    return { ok: true, stdout: stdout.trim(), stderr: '' };
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString().trim() : '';
    const stdout = err.stdout ? err.stdout.toString().trim() : '';
    return {
      ok: false,
      code: err.status ?? 1,
      stderr: stderr || err.message,
      stdout,
    };
  }
}

// --- PR & Repo Resolution ---

export function resolveRepoAndPr({ pr, cwd = process.cwd(), runner = runGh } = {}) {
  // 1. If PR is a full URL, parse owner, repo, and PR number
  if (typeof pr === 'string' && pr.startsWith('http')) {
    const match = pr.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/i);
    if (match) {
      return {
        owner: match[1],
        repo: match[2],
        prNumber: parseInt(match[3], 10),
        url: pr,
      };
    }
  }

  // 2. Query active repo
  const repoRes = runner(['repo', 'view', '--json', 'owner,name'], { cwd });
  let owner = '';
  let repo = '';
  if (repoRes.ok) {
    try {
      const parsed = JSON.parse(repoRes.stdout);
      owner = parsed.owner?.login || parsed.owner;
      repo = parsed.name;
    } catch {
      // Fallback below
    }
  }

  // 3. Resolve PR Number
  let prNumber = pr ? parseInt(pr, 10) : null;
  let prUrl = '';
  let title = '';
  let headRefName = '';
  let baseRefName = '';

  if (!prNumber || isNaN(prNumber)) {
    const viewRes = runner(
      ['pr', 'view', '--json', 'number,url,title,headRefName,baseRefName'],
      { cwd }
    );
    if (!viewRes.ok) {
      throw new Error(
        `Unable to detect active Pull Request. Make sure you are on a branch with an open PR, or pass --pr <number|url>.\nDetails: ${viewRes.stderr}`
      );
    }
    const prData = JSON.parse(viewRes.stdout);
    prNumber = prData.number;
    prUrl = prData.url;
    title = prData.title;
    headRefName = prData.headRefName;
    baseRefName = prData.baseRefName;

    // If owner/repo not yet resolved, extract from URL
    if (!owner || !repo) {
      const urlMatch = (prUrl || '').match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/i);
      if (urlMatch) {
        owner = urlMatch[1];
        repo = urlMatch[2];
      }
    }
  }

  if (!owner || !repo) {
    throw new Error(
      `Could not determine repository owner/name. Ensure 'gh repo view' works or specify a full PR URL.`
    );
  }

  return {
    owner,
    repo,
    prNumber,
    url: prUrl,
    title,
    headRefName,
    baseRefName,
  };
}

// --- Fetch Review Threads ---

export const FETCH_REVIEW_THREADS_QUERY = `
query($owner: String!, $repo: String!, $pr: Int!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $pr) {
      number
      title
      url
      headRefName
      baseRefName
      reviewThreads(first: 50, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          originalLine
          startLine
          originalStartLine
          diffHunk
          comments(last: 10) {
            nodes {
              id
              author {
                login
              }
              body
              createdAt
              url
            }
          }
        }
      }
    }
  }
}
`;

export function transformThread(threadNode) {
  const comments = (threadNode.comments?.nodes || []).map((c) => ({
    id: c.id,
    author: c.author?.login || 'unknown',
    body: c.body || '',
    createdAt: c.createdAt || '',
    url: c.url || '',
  }));

  const firstComment = comments.length > 0 ? comments[0] : null;
  const latestComment = comments.length > 0 ? comments[comments.length - 1] : null;

  return {
    id: threadNode.id,
    isResolved: Boolean(threadNode.isResolved),
    isOutdated: Boolean(threadNode.isOutdated),
    path: threadNode.path || '',
    line: threadNode.line ?? threadNode.originalLine ?? null,
    originalLine: threadNode.originalLine ?? null,
    startLine: threadNode.startLine ?? null,
    originalStartLine: threadNode.originalStartLine ?? null,
    diffHunk: threadNode.diffHunk || '',
    commentsCount: comments.length,
    firstComment,
    latestComment,
    comments,
  };
}

export async function fetchPrReviewThreads({
  pr,
  cwd = process.cwd(),
  unresolvedOnly = true,
  runner = runGh,
} = {}) {
  const info = resolveRepoAndPr({ pr, cwd, runner });
  const allThreads = [];
  let cursor = null;
  let prMeta = {
    number: info.prNumber,
    owner: info.owner,
    repo: info.repo,
    url: info.url,
    title: info.title,
    headRefName: info.headRefName,
    baseRefName: info.baseRefName,
  };

  while (true) {
    const queryArgs = [
      'api',
      'graphql',
      '-F',
      `owner=${info.owner}`,
      '-F',
      `repo=${info.repo}`,
      '-F',
      `pr=${info.prNumber}`,
      '-f',
      `query=${FETCH_REVIEW_THREADS_QUERY}`,
    ];

    if (cursor) {
      queryArgs.push('-F', `cursor=${cursor}`);
    }

    const res = runner(queryArgs, { cwd });
    if (!res.ok) {
      throw new Error(`Failed to fetch review threads via GitHub GraphQL API:\n${res.stderr}`);
    }

    const data = JSON.parse(res.stdout);
    const prNode = data.data?.repository?.pullRequest;
    if (!prNode) {
      throw new Error(
        `Pull Request #${info.prNumber} not found in repository ${info.owner}/${info.repo}.`
      );
    }

    if (prNode.url) prMeta.url = prNode.url;
    if (prNode.title) prMeta.title = prNode.title;
    if (prNode.headRefName) prMeta.headRefName = prNode.headRefName;
    if (prNode.baseRefName) prMeta.baseRefName = prNode.baseRefName;

    const threadConnection = prNode.reviewThreads;
    const nodes = threadConnection?.nodes || [];
    for (const node of nodes) {
      allThreads.push(transformThread(node));
    }

    if (threadConnection?.pageInfo?.hasNextPage && threadConnection.pageInfo.endCursor) {
      cursor = threadConnection.pageInfo.endCursor;
    } else {
      break;
    }
  }

  const filtered = unresolvedOnly
    ? allThreads.filter((t) => !t.isResolved)
    : allThreads;

  return {
    pr: prMeta,
    totalThreads: allThreads.length,
    unresolvedCount: allThreads.filter((t) => !t.isResolved).length,
    resolvedCount: allThreads.filter((t) => t.isResolved).length,
    threads: filtered,
  };
}

// --- Reply to Thread ---

export const ADD_REPLY_MUTATION = `
mutation($threadId: ID!, $body: String!) {
  addPullRequestReviewThreadReply(input: { pullRequestReviewThreadId: $threadId, body: $body }) {
    comment {
      id
      url
      body
      createdAt
    }
  }
}
`;

export async function replyToReviewThread({
  threadId,
  body,
  cwd = process.cwd(),
  runner = runGh,
} = {}) {
  if (!threadId) {
    throw new Error('Missing required option: --thread-id');
  }
  if (!body || !body.trim()) {
    throw new Error('Missing required option: --body');
  }

  const res = runner(
    [
      'api',
      'graphql',
      '-F',
      `threadId=${threadId}`,
      '-F',
      `body=${body}`,
      '-f',
      `query=${ADD_REPLY_MUTATION}`,
    ],
    { cwd }
  );

  if (!res.ok) {
    throw new Error(`Failed to add reply to review thread ${threadId}:\n${res.stderr}`);
  }

  const parsed = JSON.parse(res.stdout);
  const comment = parsed.data?.addPullRequestReviewThreadReply?.comment;
  return {
    success: true,
    threadId,
    comment,
  };
}

// --- Resolve Review Thread ---

export const RESOLVE_THREAD_MUTATION = `
mutation($threadId: ID!, $reason: PullRequestReviewThreadResolutionReason!) {
  resolveReviewThread(input: { threadId: $threadId, resolutionReason: $reason }) {
    thread {
      id
      isResolved
      resolutionReason
    }
  }
}
`;

export async function resolveReviewThread({
  threadId,
  reason = 'ADDRESSED',
  cwd = process.cwd(),
  runner = runGh,
} = {}) {
  if (!threadId) {
    throw new Error('Missing required option: --thread-id');
  }

  const normalized = normalizeReason(reason);
  if (!normalized) {
    throw new Error(
      `Invalid resolution reason "${reason}". Expected ADDRESSED, INVALID, or WONT_FIX.`
    );
  }

  const res = runner(
    [
      'api',
      'graphql',
      '-F',
      `threadId=${threadId}`,
      '-F',
      `reason=${normalized}`,
      '-f',
      `query=${RESOLVE_THREAD_MUTATION}`,
    ],
    { cwd }
  );

  if (!res.ok) {
    throw new Error(`Failed to resolve review thread ${threadId}:\n${res.stderr}`);
  }

  const parsed = JSON.parse(res.stdout);
  const thread = parsed.data?.resolveReviewThread?.thread;
  return {
    success: true,
    threadId,
    thread,
  };
}

// --- Reply and Resolve Combined ---

export async function replyAndResolveReviewThread({
  threadId,
  body,
  reason = 'ADDRESSED',
  cwd = process.cwd(),
  runner = runGh,
} = {}) {
  let replyResult = null;
  if (body && body.trim()) {
    replyResult = await replyToReviewThread({ threadId, body, cwd, runner });
  }

  const resolveResult = await resolveReviewThread({ threadId, reason, cwd, runner });

  return {
    success: true,
    threadId,
    reply: replyResult ? replyResult.comment : null,
    thread: resolveResult.thread,
  };
}

// --- Batch Resolution ---

export async function batchResolveReviewThreads({
  items = [],
  cwd = process.cwd(),
  runner = runGh,
} = {}) {
  const results = [];

  for (const item of items) {
    const threadId = item.threadId || item.id;
    const body = item.body || item.reply || '';
    const reason = item.reason || 'ADDRESSED';

    if (!threadId) {
      results.push({
        status: 'error',
        threadId: null,
        error: 'Missing threadId in batch item',
      });
      continue;
    }

    try {
      const res = await replyAndResolveReviewThread({
        threadId,
        body,
        reason,
        cwd,
        runner,
      });
      results.push({
        status: 'success',
        threadId,
        replyUrl: res.reply?.url || null,
        resolutionReason: res.thread?.resolutionReason || normalizeReason(reason),
      });
    } catch (err) {
      results.push({
        status: 'error',
        threadId,
        error: err.message,
      });
    }
  }

  return results;
}

// --- Output Formatters ---

export function formatAsTable(result) {
  const { pr, threads } = result;
  const lines = [];
  lines.push(`PR #${pr.number}: ${pr.title || 'Untitled'} (${pr.headRefName || '?'} -> ${pr.baseRefName || '?'})`);
  lines.push(`URL: ${pr.url || 'N/A'}`);
  lines.push(`Unresolved threads: ${threads.length}`);
  lines.push('');

  if (threads.length === 0) {
    lines.push('✅ No unresolved review threads found.');
    return lines.join('\n');
  }

  lines.push('| Index | Thread ID | Location | Reviewer | Latest Comment Preview | Outdated |');
  lines.push('| :--- | :--- | :--- | :--- | :--- | :--- |');

  threads.forEach((t, i) => {
    const index = `[COMMENT-${i + 1}]`;
    const loc = `${t.path}:${t.line ?? '?'}`;
    const reviewer = `@${t.latestComment?.author || t.firstComment?.author || 'unknown'}`;
    const commentText = (t.latestComment?.body || t.firstComment?.body || '')
      .replace(/\r?\n/g, ' ')
      .slice(0, 70);
    const outdated = t.isOutdated ? 'Yes' : 'No';
    lines.push(`| ${index} | \`${t.id}\` | \`${loc}\` | ${reviewer} | ${commentText}${commentText.length >= 70 ? '...' : ''} | ${outdated} |`);
  });

  return lines.join('\n');
}

// --- CLI Argument Parsing ---

export function parseArgs(rawArgs) {
  const parsed = {
    command: '',
    pr: null,
    cwd: process.cwd(),
    threadId: null,
    body: null,
    bodyFile: null,
    reason: 'ADDRESSED',
    all: false,
    format: 'json',
    out: null,
    file: null,
    help: false,
  };

  const args = [...rawArgs];
  if (args.length > 0 && !args[0].startsWith('-')) {
    parsed.command = args.shift();
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg === '--all') {
      parsed.all = true;
    } else if (arg === '--pr') {
      parsed.pr = args[++i];
    } else if (arg === '--cwd' || arg === '-C') {
      parsed.cwd = path.resolve(args[++i]);
    } else if (arg === '--thread-id' || arg === '--id') {
      parsed.threadId = args[++i];
    } else if (arg === '--body' || arg === '-m') {
      parsed.body = args[++i];
    } else if (arg === '--body-file') {
      parsed.bodyFile = args[++i];
    } else if (arg === '--reason' || arg === '-r') {
      parsed.reason = args[++i];
    } else if (arg === '--format' || arg === '-f') {
      parsed.format = args[++i];
    } else if (arg === '--out' || arg === '-o') {
      parsed.out = args[++i];
    } else if (arg === '--file') {
      parsed.file = args[++i];
    }
  }

  return parsed;
}

export function printHelp() {
  console.log(`
Usage:
  node skills/auto-code/scripts/pr-comments.mjs <command> [options]

Commands:
  fetch                Fetch review threads for a Pull Request
  reply                Post a reply comment to a review thread
  resolve              Resolve a review thread
  reply-and-resolve    Post a reply and resolve the thread in one step
  batch                Batch reply and resolve threads from a JSON file

Fetch Options:
  --pr <num|url>       Target PR number or PR URL (default: active PR on branch)
  --cwd, -C <path>     Directory of the git repository (default: current directory)
  --all                Include resolved threads (default: unresolved threads only)
  --format, -f <fmt>   Output format: json (default), table
  --out, -o <file>     Write result JSON directly to specified file

Reply & Resolve Options:
  --thread-id, --id    GraphQL thread ID (e.g. PRRT_kwDO...)
  --body, -m <text>    Comment reply body text
  --body-file <path>   Path to file containing comment reply body text
  --reason, -r <enum>  Resolution reason: ADDRESSED (default), INVALID, WONT_FIX
                       (aliases: incorrect -> INVALID, wontfix -> WONT_FIX)

Batch Options:
  --file <path>        JSON file containing array of { threadId, body, reason }
  --cwd, -C <path>     Directory of the git repository

Examples:
  # Fetch all unresolved threads for current branch's PR as JSON:
  node skills/auto-code/scripts/pr-comments.mjs fetch

  # Fetch as Markdown table:
  node skills/auto-code/scripts/pr-comments.mjs fetch --format table

  # Save threads to scratch file for planning:
  node skills/auto-code/scripts/pr-comments.mjs fetch --out .scratch/threads.json

  # Reply and resolve an addressed comment:
  node skills/auto-code/scripts/pr-comments.mjs reply-and-resolve \\
    --thread-id "PRRT_kwDO..." \\
    --reason ADDRESSED \\
    --body "Addressed in commit a1b2c3d: added null check"

  # Batch resolve comments from JSON:
  node skills/auto-code/scripts/pr-comments.mjs batch --file resolutions.json
`);
}

// --- CLI Main Execution ---

export async function main(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);

  if (opts.help || !opts.command) {
    printHelp();
    return;
  }

  // Handle body from file if specified
  let bodyText = opts.body;
  if (!bodyText && opts.bodyFile) {
    bodyText = await fs.readFile(opts.bodyFile, 'utf8');
  }

  switch (opts.command) {
    case 'fetch': {
      const result = await fetchPrReviewThreads({
        pr: opts.pr,
        cwd: opts.cwd,
        unresolvedOnly: !opts.all,
      });

      if (opts.out) {
        await fs.mkdir(path.dirname(path.resolve(opts.out)), { recursive: true });
        await fs.writeFile(path.resolve(opts.out), JSON.stringify(result, null, 2), 'utf8');
      }

      if (opts.format === 'table') {
        console.log(formatAsTable(result));
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
      break;
    }

    case 'reply': {
      if (!opts.threadId) {
        throw new Error('Missing --thread-id option.');
      }
      if (!bodyText) {
        throw new Error('Missing --body or --body-file option.');
      }
      const res = await replyToReviewThread({
        threadId: opts.threadId,
        body: bodyText,
        cwd: opts.cwd,
      });
      console.log(JSON.stringify(res, null, 2));
      break;
    }

    case 'resolve': {
      if (!opts.threadId) {
        throw new Error('Missing --thread-id option.');
      }
      const res = await resolveReviewThread({
        threadId: opts.threadId,
        reason: opts.reason,
        cwd: opts.cwd,
      });
      console.log(JSON.stringify(res, null, 2));
      break;
    }

    case 'reply-and-resolve': {
      if (!opts.threadId) {
        throw new Error('Missing --thread-id option.');
      }
      const res = await replyAndResolveReviewThread({
        threadId: opts.threadId,
        body: bodyText,
        reason: opts.reason,
        cwd: opts.cwd,
      });
      console.log(JSON.stringify(res, null, 2));
      break;
    }

    case 'batch': {
      if (!opts.file) {
        throw new Error('Missing --file option for batch command.');
      }
      const raw = await fs.readFile(path.resolve(opts.file), 'utf8');
      const items = JSON.parse(raw);
      if (!Array.isArray(items)) {
        throw new Error(`Batch file must contain a JSON array of items.`);
      }
      const results = await batchResolveReviewThreads({
        items,
        cwd: opts.cwd,
      });
      console.log(JSON.stringify(results, null, 2));
      break;
    }

    default:
      throw new Error(`Unknown command "${opts.command}". Run with --help for usage.`);
  }
}

// Execute if run directly from CLI
const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedFile === currentFile) {
  main().catch((err) => {
    console.error(`❌ pr-comments error: ${err.message}`);
    process.exit(1);
  });
}
