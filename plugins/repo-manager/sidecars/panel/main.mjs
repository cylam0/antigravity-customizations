import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Response, SidecarApp } from 'sidecar_sdk';

const HERE = dirname(fileURLToPath(import.meta.url));
const HOME = homedir();
const GLOBAL_DATA_DIR = join(HOME, '.gemini', 'config', '.data');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    contentType: 'application/json',
  });
}

function parseWorkspaceRoots(workspaceUris) {
  if (!workspaceUris) return [];
  const uris = Array.isArray(workspaceUris) ? workspaceUris : String(workspaceUris).split(',');
  return uris.map(u => {
    try {
      let trimmed = u.trim();
      if (!trimmed) return null;
      if (trimmed.startsWith('file://')) {
        trimmed = fileURLToPath(trimmed);
      } else {
        trimmed = decodeURIComponent(trimmed);
      }
      return resolve(normalize(trimmed));
    } catch {
      return null;
    }
  }).filter(Boolean);
}

function discoverFallbackRoots() {
  const roots = [];
  const projectsDir = join(HOME, '.gemini', 'config', 'projects');
  if (!existsSync(projectsDir)) return roots;

  try {
    const files = readdirSync(projectsDir)
      .filter(f => f.endsWith('.json') && !f.includes('repo-manager') && !f.includes('skills-manager'))
      .map(f => ({
        path: join(projectsDir, f),
        mtime: statSync(join(projectsDir, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    for (const file of files) {
      try {
        const content = JSON.parse(readFileSync(file.path, 'utf8'));
        const resources = content?.projectResources?.resources || [];
        for (const res of resources) {
          const folderUri = res?.gitFolder?.folderUri;
          if (folderUri) {
            try {
              const fsPath = folderUri.startsWith('file://') ? fileURLToPath(folderUri) : folderUri;
              const canonical = resolve(normalize(fsPath));
              if (existsSync(canonical) && !roots.includes(canonical)) {
                roots.push(canonical);
              }
            } catch {
              // ignore
            }
          }
        }
        if (roots.length > 0) break; // Use most recent project
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
  return roots;
}

function getStateFilePath(wsRoots = []) {
  if (wsRoots.length > 0) {
    const wsDataDir = join(wsRoots[0], '.agents', '.data');
    try {
      mkdirSync(wsDataDir, { recursive: true });
      return join(wsDataDir, 'active-repos.json');
    } catch {
      // Fallback to global
    }
  }
  mkdirSync(GLOBAL_DATA_DIR, { recursive: true });
  return join(GLOBAL_DATA_DIR, 'active-repos.json');
}

function readState(wsRoots = []) {
  const filePath = getStateFilePath(wsRoots);
  if (!existsSync(filePath)) {
    return { default: [], conversations: {} };
  }
  try {
    const raw = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      default: Array.isArray(parsed.default) ? parsed.default : [],
      conversations: typeof parsed.conversations === 'object' && parsed.conversations !== null ? parsed.conversations : {},
    };
  } catch {
    return { default: [], conversations: {} };
  }
}

function writeState(state, wsRoots = []) {
  const filePath = getStateFilePath(wsRoots);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8');
}

function runGit(repoPath, args) {
  try {
    return execFileSync('git', ['-C', repoPath, ...args], {
      encoding: 'utf8',
      timeout: 3000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function getRepoMetadata(repoPath, workspaceRoot) {
  const branch = runGit(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD']) || 'unknown';
  const statusOut = runGit(repoPath, ['status', '--porcelain']) || '';
  const lines = statusOut.split('\n').filter(Boolean);
  const dirtyCount = lines.length;

  const isProtected = ['main', 'master', 'production'].includes(branch) || branch.startsWith('release/');
  const folderName = basename(repoPath);
  const relativePath = workspaceRoot ? normalize(repoPath).replace(normalize(workspaceRoot), '').replace(/^[\\/]/, '') : folderName;

  return {
    path: repoPath,
    name: folderName,
    relativePath: relativePath || '.',
    branch,
    isProtected,
    isClean: dirtyCount === 0,
    dirtyCount,
  };
}

function scanForGitRepos(wsRoots) {
  const discovered = new Map();
  const IGNORED_NAMES = new Set(['node_modules', '.git', '.data', '.cache', 'dist', 'build', 'out', 'target', '.agents', '.gemini']);

  const targets = (Array.isArray(wsRoots) && wsRoots.length > 0)
    ? wsRoots
    : discoverFallbackRoots();

  for (const root of targets) {
    const canonicalRoot = resolve(normalize(root));
    if (!existsSync(canonicalRoot)) continue;

    // Check if root itself is a repo
    if (existsSync(join(canonicalRoot, '.git'))) {
      discovered.set(canonicalRoot, getRepoMetadata(canonicalRoot, canonicalRoot));
    }

    // Scan immediate subdirectories
    let entries;
    try {
      entries = readdirSync(canonicalRoot, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || IGNORED_NAMES.has(entry.name)) continue;
      const subPath = join(canonicalRoot, entry.name);

      if (existsSync(join(subPath, '.git'))) {
        discovered.set(subPath, getRepoMetadata(subPath, canonicalRoot));
      } else {
        // Depth 2 scan (e.g. packages/repoA or services/repoB)
        let subEntries;
        try {
          subEntries = readdirSync(subPath, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const subEntry of subEntries) {
          if (!subEntry.isDirectory() || IGNORED_NAMES.has(subEntry.name)) continue;
          const nestedPath = join(subPath, subEntry.name);
          if (existsSync(join(nestedPath, '.git'))) {
            discovered.set(nestedPath, getRepoMetadata(nestedPath, canonicalRoot));
          }
        }
      }
    }
  }

  return Array.from(discovered.values());
}

// ---------------------------------------------------------------------------
// SidecarApp Server
// ---------------------------------------------------------------------------

const app = new SidecarApp();

app.page('/', () => readFileSync(join(HERE, 'index.html'), 'utf8'));
app.page('/app.js', () => readFileSync(join(HERE, 'app.js'), 'utf8'));
app.api('/styles.css', () => new Response(readFileSync(join(HERE, 'styles.css'), 'utf8'), { contentType: 'text/css' }), 'GET');

// GET /api/repos
app.api('/api/repos', (data) => {
  try {
    const wsRoots = parseWorkspaceRoots(data?.workspaceUris);
    const conversationId = data?.conversationId ? String(data.conversationId) : null;
    const repos = scanForGitRepos(wsRoots);
    const state = readState(wsRoots);

    // Resolve active selection
    let activeSelected = [];
    if (conversationId && Array.isArray(state.conversations[conversationId])) {
      activeSelected = state.conversations[conversationId];
    } else {
      activeSelected = state.default;
    }

    const reposWithSelection = repos.map(r => ({
      ...r,
      selected: activeSelected.includes(r.path),
    }));

    return jsonResponse({
      repos: reposWithSelection,
      selectedCount: reposWithSelection.filter(r => r.selected).length,
      totalCount: repos.length,
      conversationId: conversationId || null,
      isPerConversation: Boolean(conversationId && state.conversations[conversationId]),
    }, 200);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}, 'GET');

// POST /api/repos/select
app.api('/api/repos/select', (data) => {
  try {
    const wsRoots = parseWorkspaceRoots(data?.workspaceUris);
    const conversationId = data?.conversationId ? String(data.conversationId) : null;
    const selectedPaths = Array.isArray(data?.selectedPaths) ? data.selectedPaths.map(p => resolve(normalize(p))) : [];

    const state = readState(wsRoots);

    if (conversationId) {
      state.conversations[conversationId] = selectedPaths;
    }
    // Also update default if no conversation or explicitly set
    state.default = selectedPaths;

    writeState(state, wsRoots);

    return jsonResponse({
      success: true,
      selectedPaths,
      conversationId: conversationId || null,
    }, 200);
  } catch (err) {
    return jsonResponse({ error: err.message }, 400);
  }
});

app.run();
