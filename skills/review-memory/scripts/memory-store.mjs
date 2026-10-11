#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const BASE_DIR = path.join(os.homedir(), '.gemini', 'memory', 'code-review');
const SESSION_FILE = path.join(BASE_DIR, 'recent_session.json');

// --- Helper Functions ---

export function resolveRepoSlug(repoRoot, remoteUrl = '') {
  if (remoteUrl) {
    const clean = remoteUrl.replace(/^(https?:\/\/|git@)/, '').replace(/[:/]/g, '_').replace(/\.git$/, '');
    return clean;
  }
  const base = path.basename(repoRoot).replace(/[^a-zA-Z0-9_-]/g, '_');
  const hash = crypto.createHash('sha256').update(path.resolve(repoRoot).toLowerCase()).digest('hex').slice(0, 8);
  return `${base}_${hash}`;
}

export function resolveGitBranch(repoPath) {
  try {
    const branch = execFileSync('git', ['-C', repoPath, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    if (branch && branch !== 'HEAD') return branch;
    const commit = execFileSync('git', ['-C', repoPath, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    return `detached_${commit || 'unknown'}`;
  } catch {
    return 'default';
  }
}

export function resolveGitRemote(repoPath) {
  try {
    return execFileSync('git', ['-C', repoPath, 'remote', 'get-url', 'origin'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

export function resolveGitCommit(repoPath) {
  try {
    return execFileSync('git', ['-C', repoPath, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

export function sanitizeBranch(branchName) {
  return (branchName || 'default')
    .trim()
    .replace(/[\\/:*?"<>|#]/g, '__')
    .replace(/\s+/g, '_');
}

export function normalizeFilePath(filePath) {
  return filePath ? filePath.replace(/\\/g, '/').toLowerCase().trim() : '';
}

export function computeAnchorSignature(file, domain = '', codeSnippet = '', title = '') {
  const normFile = normalizeFilePath(file);
  const normSnippet = (codeSnippet || '').replace(/\s+/g, ' ').trim().slice(0, 160);
  const normTitle = (title || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
  const raw = `${normFile}|${(domain || '').toLowerCase()}|${normSnippet}|${normTitle}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

export async function atomicWriteJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tempPath, filePath);
}

export async function readJson(filePath, defaultVal = null) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return defaultVal;
  }
}

function getRepoPaths(repoRoot, remoteUrl = '') {
  const slug = resolveRepoSlug(repoRoot, remoteUrl);
  const repoDir = path.join(BASE_DIR, slug);
  return {
    slug,
    repoDir,
    conventionsFile: path.join(repoDir, 'conventions.json'),
    branchesDir: path.join(repoDir, 'branches'),
    getBranchFile: (branch) => path.join(repoDir, 'branches', `${sanitizeBranch(branch)}.json`)
  };
}

// --- Core API Operations ---

export async function saveSession(findings, repoPath, branch, remoteUrl = '') {
  const repoRoot = path.resolve(repoPath || process.cwd());
  const activeBranch = branch || resolveGitBranch(repoRoot);
  const activeRemote = remoteUrl || resolveGitRemote(repoRoot);
  const headCommit = resolveGitCommit(repoRoot);
  const { slug } = getRepoPaths(repoRoot, activeRemote);

  const indexedFindings = findings.map((f, i) => {
    const id = f.id || `REV-${i + 1}`;
    const signature = f.signature || computeAnchorSignature(f.file, f.type || f.domain, f.fix || f.snippet || '', f.title || f.message || '');
    return {
      ...f,
      id,
      repo: repoRoot,
      repoSlug: slug,
      branch: activeBranch,
      signature
    };
  });

  const session = {
    updatedAt: new Date().toISOString(),
    headCommit,
    findings: indexedFindings
  };

  await atomicWriteJson(SESSION_FILE, session);
  return indexedFindings;
}

export async function recordDecision({ id, status, rationale = '', scope = 'branch', repoPath, branch, signature }) {
  let targetFinding = null;
  const session = await readJson(SESSION_FILE);

  if (id && session?.findings) {
    targetFinding = session.findings.find(f => f.id.toUpperCase() === id.toUpperCase());
  }

  const resolvedRepo = path.resolve(repoPath || targetFinding?.repo || process.cwd());
  const resolvedBranch = branch || targetFinding?.branch || resolveGitBranch(resolvedRepo);
  const resolvedSig = signature || targetFinding?.signature || computeAnchorSignature(
    targetFinding?.file || '',
    targetFinding?.type || targetFinding?.domain || '',
    targetFinding?.fix || '',
    targetFinding?.title || targetFinding?.message || ''
  );

  const { getBranchFile, conventionsFile } = getRepoPaths(resolvedRepo);
  const record = {
    id: id || targetFinding?.id || 'MANUAL',
    signature: resolvedSig,
    status: status === 'accepted' ? 'accepted' : 'dismissed',
    rationale: rationale.trim(),
    file: targetFinding?.file || '',
    domain: targetFinding?.type || targetFinding?.domain || '',
    scope: scope === 'repo' ? 'repo' : 'branch',
    branch: resolvedBranch,
    timestamp: new Date().toISOString()
  };

  if (scope === 'repo') {
    const convs = (await readJson(conventionsFile, [])) || [];
    const idx = convs.findIndex(c => c.signature === resolvedSig);
    if (idx >= 0) convs[idx] = { ...convs[idx], ...record };
    else convs.push(record);
    await atomicWriteJson(conventionsFile, convs);
  } else {
    const branchFile = getBranchFile(resolvedBranch);
    const branchDecisions = (await readJson(branchFile, [])) || [];
    const idx = branchDecisions.findIndex(d => d.signature === resolvedSig || (id && d.id === id));
    if (idx >= 0) branchDecisions[idx] = record;
    else branchDecisions.push(record);
    await atomicWriteJson(branchFile, branchDecisions);
  }

  return { success: true, record, branch: resolvedBranch, repo: resolvedRepo };
}

export async function revokeDecision({ id, signature, repoPath, branch }) {
  let targetFinding = null;
  const session = await readJson(SESSION_FILE);
  if (id && session?.findings) {
    targetFinding = session.findings.find(f => f.id.toUpperCase() === id.toUpperCase());
  }

  const resolvedRepo = path.resolve(repoPath || targetFinding?.repo || process.cwd());
  const resolvedBranch = branch || targetFinding?.branch || resolveGitBranch(resolvedRepo);
  const { getBranchFile, conventionsFile } = getRepoPaths(resolvedRepo);

  let revoked = false;
  // Check branch
  const branchFile = getBranchFile(resolvedBranch);
  const branchDecisions = (await readJson(branchFile, [])) || [];
  const filteredBranch = branchDecisions.filter(d => {
    const match = (id && d.id.toUpperCase() === id.toUpperCase()) || (signature && d.signature === signature);
    if (match) revoked = true;
    return !match;
  });
  if (revoked) await atomicWriteJson(branchFile, filteredBranch);

  // Check repo conventions
  const convs = (await readJson(conventionsFile, [])) || [];
  const filteredConvs = convs.filter(c => {
    const match = (id && c.id && c.id.toUpperCase() === id.toUpperCase()) || (signature && c.signature === signature);
    if (match) revoked = true;
    return !match;
  });
  if (revoked) await atomicWriteJson(conventionsFile, filteredConvs);

  return { success: revoked, id, branch: resolvedBranch };
}

export async function addConvention({ repoPath, rule, rationale = '', tags = [], source = 'user', scope = 'repository', severityGuidance = 'warning' }) {
  const repoRoot = path.resolve(repoPath || process.cwd());
  const { conventionsFile } = getRepoPaths(repoRoot);
  const convs = (await readJson(conventionsFile, [])) || [];

  const entry = {
    id: `CONV-${Date.now().toString(36).toUpperCase()}`,
    rule: rule.trim(),
    rationale: (rationale || '').trim(),
    tags: Array.isArray(tags) ? tags : String(tags).split(',').map(t => t.trim()).filter(Boolean),
    source: (source || 'user').trim(),
    scope: scope === 'branch' ? 'branch' : 'repository',
    severityGuidance: severityGuidance || 'warning',
    timestamp: new Date().toISOString()
  };

  convs.push(entry);
  await atomicWriteJson(conventionsFile, convs);
  return entry;
}

export async function queryMemory({ repoPath, branch, files = [] }) {
  const repoRoot = path.resolve(repoPath || process.cwd());
  const activeBranch = branch || resolveGitBranch(repoRoot);
  const { getBranchFile, conventionsFile } = getRepoPaths(repoRoot);

  const branchDecisions = (await readJson(getBranchFile(activeBranch), [])) || [];
  const repoConventions = (await readJson(conventionsFile, [])) || [];

  const dismissed = branchDecisions.filter(d => d.status === 'dismissed');
  const accepted = branchDecisions.filter(d => d.status === 'accepted');

  // Filter conventions by files if provided
  let filteredConventions = repoConventions;
  if (files && files.length > 0) {
    const extSet = new Set(files.map(f => path.extname(f).replace('.', '').toLowerCase()));
    filteredConventions = repoConventions.filter(conv => {
      if (!conv.tags || conv.tags.length === 0) return true;
      return conv.tags.some(t => extSet.has(t.toLowerCase()) || files.some(f => f.toLowerCase().includes(t.toLowerCase())));
    });
  }

  // Cap top 15 conventions
  const activeConventions = filteredConventions.slice(0, 15);

  return {
    branch: activeBranch,
    repo: repoRoot,
    dismissedSignatures: dismissed.map(d => d.signature),
    dismissed,
    accepted,
    activeConventions
  };
}

export async function listMemory({ repoPath, branch }) {
  const repoRoot = path.resolve(repoPath || process.cwd());
  const activeBranch = branch || resolveGitBranch(repoRoot);
  const data = await queryMemory({ repoPath: repoRoot, branch: activeBranch });
  const session = await readJson(SESSION_FILE);
  return {
    currentBranch: activeBranch,
    repoRoot,
    recentSession: session?.headCommit ? { headCommit: session.headCommit, count: session.findings?.length || 0 } : null,
    dismissedCount: data.dismissed.length,
    dismissed: data.dismissed,
    acceptedCount: data.accepted.length,
    conventionsCount: data.activeConventions.length,
    conventions: data.activeConventions
  };
}

// --- CLI Parsing & Stdin Handler ---

async function readPayload() {
  const args = process.argv.slice(3);
  let payload = {};

  // Check stdin
  if (!process.stdin.isTTY) {
    try {
      const chunks = [];
      for await (const chunk of process.stdin) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (raw) payload = JSON.parse(raw);
    } catch {
      // ignore empty stdin
    }
  }

  // Check CLI arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--payload-json' && args[i + 1]) {
      try { Object.assign(payload, JSON.parse(args[++i])); } catch {}
    } else if (arg.startsWith('--') && args[i + 1] && !args[i + 1].startsWith('--')) {
      const key = arg.slice(2);
      payload[key] = args[++i];
    } else if (arg.startsWith('--')) {
      payload[arg.slice(2)] = true;
    }
  }

  return payload;
}

async function main() {
  const cmd = process.argv[2];
  if (!cmd || cmd === 'help' || cmd === '--help') {
    console.log(`Usage: node memory-store.mjs <command> [options]
Commands:
  save-session     Save findings to recent session index
  record-decision  Record accept/dismiss for a finding ID or signature
  revoke-decision  Undo a recorded decision for a finding ID
  add-convention   Save a PR or discussion convention
  query            Get active dismissed rationales and conventions
  list             Display stored memory overview
  clear            Clear branch decisions or session`);
    return;
  }

  const payload = await readPayload();

  try {
    let result = null;
    switch (cmd) {
      case 'save-session':
        result = await saveSession(payload.findings || [], payload.repo, payload.branch);
        break;
      case 'record-decision':
        result = await recordDecision(payload);
        break;
      case 'revoke-decision':
        result = await revokeDecision(payload);
        break;
      case 'add-convention':
        result = await addConvention(payload);
        break;
      case 'query':
        result = await queryMemory({
          repoPath: payload.repo,
          branch: payload.branch,
          files: payload.files ? String(payload.files).split(',') : []
        });
        break;
      case 'list':
        result = await listMemory({ repoPath: payload.repo, branch: payload.branch });
        break;
      default:
        console.error(`Unknown command: ${cmd}`);
        process.exit(1);
    }
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, '$1'))) {
  main();
}
