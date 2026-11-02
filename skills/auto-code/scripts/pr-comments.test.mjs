import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  normalizeReason,
  parseArgs,
  transformThread,
  formatAsTable,
  resolveRepoAndPr,
  fetchPrReviewThreads,
  replyToReviewThread,
  resolveReviewThread,
  replyAndResolveReviewThread,
  batchResolveReviewThreads,
} from './pr-comments.mjs';

test('normalizeReason: maps valid aliases and casing to GitHub GraphQL enums', () => {
  assert.equal(normalizeReason('ADDRESSED'), 'ADDRESSED');
  assert.equal(normalizeReason('addressed'), 'ADDRESSED');
  assert.equal(normalizeReason('Fixed'), 'ADDRESSED');
  assert.equal(normalizeReason('resolved'), 'ADDRESSED');

  assert.equal(normalizeReason('INVALID'), 'INVALID');
  assert.equal(normalizeReason('invalid'), 'INVALID');
  assert.equal(normalizeReason('incorrect'), 'INVALID');
  assert.equal(normalizeReason('INCORRECT'), 'INVALID');

  assert.equal(normalizeReason('WONT_FIX'), 'WONT_FIX');
  assert.equal(normalizeReason('wont_fix'), 'WONT_FIX');
  assert.equal(normalizeReason('wontfix'), 'WONT_FIX');
  assert.equal(normalizeReason("won't fix"), 'WONT_FIX');
  assert.equal(normalizeReason('deferred'), 'WONT_FIX');

  assert.equal(normalizeReason('unknown_reason'), null);
  assert.equal(normalizeReason(''), null);
  assert.equal(normalizeReason(null), null);
});

test('parseArgs: accurately parses commands, flags, and aliases', () => {
  const parsed1 = parseArgs(['fetch', '--pr', '42', '--format', 'table', '--all']);
  assert.equal(parsed1.command, 'fetch');
  assert.equal(parsed1.pr, '42');
  assert.equal(parsed1.format, 'table');
  assert.equal(parsed1.all, true);

  const parsed2 = parseArgs([
    'reply-and-resolve',
    '--thread-id',
    'PRRT_123',
    '-m',
    'Fixed bug',
    '-r',
    'incorrect',
    '-o',
    'result.json',
  ]);
  assert.equal(parsed2.command, 'reply-and-resolve');
  assert.equal(parsed2.threadId, 'PRRT_123');
  assert.equal(parsed2.body, 'Fixed bug');
  assert.equal(parsed2.reason, 'incorrect');
  assert.equal(parsed2.out, 'result.json');

  const parsed3 = parseArgs(['--help']);
  assert.equal(parsed3.help, true);
});

test('transformThread: normalizes GraphQL thread node into structured format', () => {
  const mockNode = {
    id: 'PRRT_kwDO123',
    isResolved: false,
    isOutdated: true,
    path: 'src/utils/math.ts',
    line: 55,
    originalLine: 50,
    diffHunk: '@@ -50,6 +50,7 @@\n+ return a + b;',
    comments: {
      nodes: [
        {
          id: 'PRRC_1',
          author: { login: 'reviewer1' },
          body: 'Check for integer overflow',
          createdAt: '2026-10-30T10:00:00Z',
          url: 'https://github.com/owner/repo/pull/1#discussion_r1',
        },
        {
          id: 'PRRC_2',
          author: { login: 'reviewer2' },
          body: 'Agreed, please use BigInt or bounds check',
          createdAt: '2026-10-30T11:00:00Z',
          url: 'https://github.com/owner/repo/pull/1#discussion_r2',
        },
      ],
    },
  };

  const transformed = transformThread(mockNode);
  assert.equal(transformed.id, 'PRRT_kwDO123');
  assert.equal(transformed.isResolved, false);
  assert.equal(transformed.isOutdated, true);
  assert.equal(transformed.path, 'src/utils/math.ts');
  assert.equal(transformed.line, 55);
  assert.equal(transformed.commentsCount, 2);
  assert.equal(transformed.firstComment.author, 'reviewer1');
  assert.equal(transformed.firstComment.body, 'Check for integer overflow');
  assert.equal(transformed.latestComment.author, 'reviewer2');
  assert.equal(transformed.latestComment.body, 'Agreed, please use BigInt or bounds check');
});

test('formatAsTable: formats threads into clean Markdown table', () => {
  const result = {
    pr: {
      number: 10,
      title: 'Fix auth session leak',
      headRefName: 'fix/auth',
      baseRefName: 'main',
      url: 'https://github.com/test/repo/pull/10',
    },
    threads: [
      {
        id: 'PRRT_abc',
        path: 'src/auth.ts',
        line: 42,
        isOutdated: false,
        latestComment: {
          author: 'security-reviewer',
          body: 'Potential null dereference when session token is missing',
        },
        firstComment: {
          author: 'security-reviewer',
          body: 'Potential null dereference when session token is missing',
        },
      },
    ],
  };

  const tableStr = formatAsTable(result);
  assert.match(tableStr, /PR #10: Fix auth session leak/);
  assert.match(tableStr, /\| Index \| Thread ID \| Location \| Reviewer \|/);
  assert.match(tableStr, /\[COMMENT-1\]/);
  assert.match(tableStr, /PRRT_abc/);
  assert.match(tableStr, /src\/auth\.ts:42/);
  assert.match(tableStr, /@security-reviewer/);
});

test('resolveRepoAndPr: parses full PR URL without requiring gh query', () => {
  const resolved = resolveRepoAndPr({
    pr: 'https://github.com/google/antigravity/pull/88',
  });
  assert.equal(resolved.owner, 'google');
  assert.equal(resolved.repo, 'antigravity');
  assert.equal(resolved.prNumber, 88);
});

test('resolveRepoAndPr: queries gh when PR number or branch needs detection', () => {
  const mockRunner = (args) => {
    if (args[0] === 'repo' && args[1] === 'view') {
      return {
        ok: true,
        stdout: JSON.stringify({ owner: { login: 'myorg' }, name: 'myrepo' }),
      };
    }
    if (args[0] === 'pr' && args[1] === 'view') {
      return {
        ok: true,
        stdout: JSON.stringify({
          number: 123,
          url: 'https://github.com/myorg/myrepo/pull/123',
          title: 'Add feature',
          headRefName: 'feature-x',
          baseRefName: 'main',
        }),
      };
    }
    return { ok: false, stderr: 'Unknown command' };
  };

  const resolved = resolveRepoAndPr({ runner: mockRunner });
  assert.equal(resolved.owner, 'myorg');
  assert.equal(resolved.repo, 'myrepo');
  assert.equal(resolved.prNumber, 123);
  assert.equal(resolved.title, 'Add feature');
});

test('fetchPrReviewThreads: fetches and filters review threads with pagination support', async () => {
  let callCount = 0;
  const mockRunner = (args) => {
    if (args[0] === 'repo' && args[1] === 'view') {
      return { ok: true, stdout: JSON.stringify({ owner: 'org', name: 'repo' }) };
    }
    if (args[0] === 'api' && args[1] === 'graphql') {
      callCount++;
      if (callCount === 1) {
        return {
          ok: true,
          stdout: JSON.stringify({
            data: {
              repository: {
                pullRequest: {
                  number: 5,
                  title: 'Test PR',
                  url: 'https://github.com/org/repo/pull/5',
                  reviewThreads: {
                    pageInfo: { hasNextPage: true, endCursor: 'cursor_page_2' },
                    nodes: [
                      {
                        id: 'THREAD_1',
                        isResolved: false,
                        path: 'file1.js',
                        line: 10,
                        comments: { nodes: [{ id: 'C1', body: 'issue 1' }] },
                      },
                      {
                        id: 'THREAD_2',
                        isResolved: true,
                        path: 'file2.js',
                        line: 20,
                        comments: { nodes: [{ id: 'C2', body: 'already fixed' }] },
                      },
                    ],
                  },
                },
              },
            },
          }),
        };
      } else {
        return {
          ok: true,
          stdout: JSON.stringify({
            data: {
              repository: {
                pullRequest: {
                  reviewThreads: {
                    pageInfo: { hasNextPage: false, endCursor: null },
                    nodes: [
                      {
                        id: 'THREAD_3',
                        isResolved: false,
                        path: 'file3.js',
                        line: 30,
                        comments: { nodes: [{ id: 'C3', body: 'issue 3' }] },
                      },
                    ],
                  },
                },
              },
            },
          }),
        };
      }
    }
    return { ok: false, stderr: 'error' };
  };

  const resUnresolved = await fetchPrReviewThreads({
    pr: 5,
    unresolvedOnly: true,
    runner: mockRunner,
  });

  assert.equal(callCount, 2);
  assert.equal(resUnresolved.totalThreads, 3);
  assert.equal(resUnresolved.unresolvedCount, 2);
  assert.equal(resUnresolved.resolvedCount, 1);
  assert.equal(resUnresolved.threads.length, 2);
  assert.equal(resUnresolved.threads[0].id, 'THREAD_1');
  assert.equal(resUnresolved.threads[1].id, 'THREAD_3');
});

test('replyToReviewThread & resolveReviewThread: executes mutations and maps reasons', async () => {
  const executedCalls = [];
  const mockRunner = (args) => {
    executedCalls.push(args);
    if (args.some((a) => a.includes('addPullRequestReviewThreadReply'))) {
      return {
        ok: true,
        stdout: JSON.stringify({
          data: {
            addPullRequestReviewThreadReply: {
              comment: { id: 'PRRC_new', url: 'https://comment/1' },
            },
          },
        }),
      };
    }
    if (args.some((a) => a.includes('resolveReviewThread'))) {
      return {
        ok: true,
        stdout: JSON.stringify({
          data: {
            resolveReviewThread: {
              thread: { id: 'THREAD_100', isResolved: true, resolutionReason: 'ADDRESSED' },
            },
          },
        }),
      };
    }
    return { ok: false, stderr: 'error' };
  };

  const replyRes = await replyToReviewThread({
    threadId: 'THREAD_100',
    body: 'Addressed in commit abc',
    runner: mockRunner,
  });
  assert.equal(replyRes.success, true);
  assert.equal(replyRes.comment.id, 'PRRC_new');

  const resolveRes = await resolveReviewThread({
    threadId: 'THREAD_100',
    reason: 'addressed',
    runner: mockRunner,
  });
  assert.equal(resolveRes.success, true);
  assert.equal(resolveRes.thread.isResolved, true);
  assert.equal(resolveRes.thread.resolutionReason, 'ADDRESSED');
});

test('replyAndResolveReviewThread & batchResolveReviewThreads: resilient execution', async () => {
  const mockRunner = (args) => {
    if (args.includes('threadId=THREAD_FAIL')) {
      return { ok: false, stderr: 'Permission denied to resolve thread' };
    }
    if (args.some((a) => a.includes('addPullRequestReviewThreadReply'))) {
      return {
        ok: true,
        stdout: JSON.stringify({
          data: {
            addPullRequestReviewThreadReply: {
              comment: { id: 'PRRC_1', url: 'https://github.com/r1' },
            },
          },
        }),
      };
    }
    if (args.some((a) => a.includes('resolveReviewThread'))) {
      return {
        ok: true,
        stdout: JSON.stringify({
          data: {
            resolveReviewThread: {
              thread: { id: 'THREAD_OK', isResolved: true, resolutionReason: 'INVALID' },
            },
          },
        }),
      };
    }
    return { ok: false, stderr: 'error' };
  };

  const batchResults = await batchResolveReviewThreads({
    items: [
      { threadId: 'THREAD_OK', body: 'Pushback rationale', reason: 'incorrect' },
      { threadId: 'THREAD_FAIL', body: 'Some fix', reason: 'addressed' },
    ],
    runner: mockRunner,
  });

  assert.equal(batchResults.length, 2);
  assert.equal(batchResults[0].status, 'success');
  assert.equal(batchResults[0].threadId, 'THREAD_OK');
  assert.equal(batchResults[0].replyUrl, 'https://github.com/r1');

  assert.equal(batchResults[1].status, 'error');
  assert.equal(batchResults[1].threadId, 'THREAD_FAIL');
  assert.match(batchResults[1].error, /Permission denied/);
});
