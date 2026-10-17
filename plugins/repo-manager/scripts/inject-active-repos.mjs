import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';

function run() {
  let inputRaw = '';
  try {
    inputRaw = readFileSync(0, 'utf8');
  } catch {
    console.log(JSON.stringify({}));
    return;
  }

  if (!inputRaw.trim()) {
    console.log(JSON.stringify({}));
    return;
  }

  let payload = {};
  try {
    payload = JSON.parse(inputRaw);
  } catch {
    console.log(JSON.stringify({}));
    return;
  }

  const workspacePaths = Array.isArray(payload.workspacePaths) ? payload.workspacePaths : [];
  const conversationId = payload.conversationId ? String(payload.conversationId) : null;

  // Locate state file
  let stateFilePath = null;
  for (const ws of workspacePaths) {
    const candidate = join(ws, '.agents', '.data', 'active-repos.json');
    if (existsSync(candidate)) {
      stateFilePath = candidate;
      break;
    }
  }

  if (!stateFilePath) {
    const globalCandidate = join(homedir(), '.gemini', 'config', '.data', 'active-repos.json');
    if (existsSync(globalCandidate)) {
      stateFilePath = globalCandidate;
    }
  }

  if (!stateFilePath || !existsSync(stateFilePath)) {
    console.log(JSON.stringify({}));
    return;
  }

  let state = {};
  try {
    state = JSON.parse(readFileSync(stateFilePath, 'utf8'));
  } catch {
    console.log(JSON.stringify({}));
    return;
  }

  let selectedRepos = [];
  if (conversationId && state.conversations && Array.isArray(state.conversations[conversationId]) && state.conversations[conversationId].length > 0) {
    selectedRepos = state.conversations[conversationId];
  } else if (Array.isArray(state.default) && state.default.length > 0) {
    selectedRepos = state.default;
  }

  if (!selectedRepos || selectedRepos.length === 0) {
    // Permissive fallback: no repos selected, do not inject constraints
    console.log(JSON.stringify({}));
    return;
  }

  const repoDetails = selectedRepos.map(repoPath => {
    let branch = 'unknown';
    try {
      branch = execFileSync('git', ['-C', repoPath, 'rev-parse', '--abbrev-ref', 'HEAD'], {
        encoding: 'utf8',
        timeout: 2000,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch {
      // ignore
    }
    const name = basename(repoPath);
    const isProtected = ['main', 'master', 'production'].includes(branch) || branch.startsWith('release/');
    return `- ${name} (${repoPath}) [branch: ${branch}${isProtected ? ' (protected)' : ''}]`;
  });

  const message = `ACTIVE REPOSITORY SCOPE (selected in Repo Manager):\n` +
    `${repoDetails.join('\n')}\n\n` +
    `INSTRUCTION: Restrict tool commands (Cwd), file searches, and modifications to the active repositories listed above.`;

  console.log(JSON.stringify({
    injectSteps: [
      {
        ephemeralMessage: message,
      },
    ],
  }));
}

run();
