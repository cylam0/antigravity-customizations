import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Response, SidecarApp } from 'sidecar_sdk';

const HERE = dirname(fileURLToPath(import.meta.url));
const HOME = homedir();
const GLOBAL_SKILLS_DIR = join(HOME, '.gemini', 'config', 'skills');
const BUILTIN_SKILLS_DIR = join(HOME, '.gemini', 'antigravity', 'builtin', 'skills');

const STANDARD_ROOTS = [GLOBAL_SKILLS_DIR, BUILTIN_SKILLS_DIR];

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
      const trimmed = u.trim();
      if (!trimmed) return null;
      const fsPath = trimmed.startsWith('file://') ? fileURLToPath(trimmed) : trimmed;
      return join(fsPath, '.agents', 'skills');
    } catch {
      return null;
    }
  }).filter(Boolean);
}

function assertAllowedPath(targetPath, extraRoots = []) {
  const isWindows = process.platform === 'win32';
  const canonical = resolve(normalize(targetPath));
  const compCanonical = isWindows ? canonical.toLowerCase() : canonical;

  const allRoots = [...STANDARD_ROOTS, ...extraRoots].map(r => {
    const res = resolve(normalize(r));
    return isWindows ? res.toLowerCase() : res;
  });

  const ok = allRoots.some(root =>
    compCanonical === root || compCanonical.startsWith(root + (root.endsWith(sep) ? '' : sep))
  );

  if (!ok) {
    throw new Error(`Access denied: path is outside allowed skill directories.`);
  }
  return canonical;
}

function safeRename(source, dest, maxRetries = 3, delayMs = 50) {
  mkdirSync(dirname(dest), { recursive: true });
  if (existsSync(dest)) {
    throw new Error(`Target directory already exists: ${dest}`);
  }
  for (let i = 0; i < maxRetries; i++) {
    try {
      renameSync(source, dest);
      return;
    } catch (err) {
      if ((err.code === 'EPERM' || err.code === 'EBUSY') && i < maxRetries - 1) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
        continue;
      }
      throw err;
    }
  }
}

function extractMetadata(content) {
  const sanitized = content.replace(/^\uFEFF/, '');
  const match = sanitized.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { name: '', description: '' };
  const yaml = match[1];

  const nameMatch = yaml.match(/^\s*name\s*:\s*([^\r\n]+)/m);
  const name = nameMatch ? nameMatch[1].trim().replace(/^['"]|['"]$/g, '') : '';

  let description = '';
  const inlineMatch = yaml.match(/^\s*description\s*:\s*([^\r\n>|]+)$/m);
  if (inlineMatch && inlineMatch[1].trim()) {
    description = inlineMatch[1].trim().replace(/^['"]|['"]$/g, '');
  } else {
    const blockMatch = yaml.match(/^\s*description\s*:\s*[>|]-?\r?\n((?:[ \t]+[^\r\n]*\r?\n?)+)/m);
    if (blockMatch) {
      description = blockMatch[1]
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean)
        .join(' ');
    }
  }
  return { name, description };
}

function validateFrontmatter(content) {
  const sanitized = content.replace(/^\uFEFF/, '');
  const match = sanitized.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) throw new Error("SKILL.md must begin with a '---' YAML frontmatter block.");
  const yaml = match[1];
  if (!/^\s*name\s*:\s*[^\s]/m.test(yaml)) throw new Error("Missing 'name:' in YAML frontmatter.");
  if (!/^\s*description\s*:\s*[^\s]/m.test(yaml)) throw new Error("Missing 'description:' in YAML frontmatter.");
}

function scanSkillDir(baseDir, scope, isExplicitDisabled = false) {
  if (!existsSync(baseDir)) return [];
  const results = [];

  let entries;
  try {
    entries = readdirSync(baseDir, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    // Scan .disabled folder recursively
    if (entry.name === '.disabled' && !isExplicitDisabled) {
      const disabledSkills = scanSkillDir(join(baseDir, '.disabled'), scope, true);
      results.push(...disabledSkills);
      continue;
    }

    if (entry.name.startsWith('.') && !isExplicitDisabled) continue;

    const skillPath = join(baseDir, entry.name);
    const skillFile = join(skillPath, 'SKILL.md');
    if (!existsSync(skillFile)) continue;

    try {
      const content = readFileSync(skillFile, 'utf8');
      const { name, description } = extractMetadata(content);
      results.push({
        id: `${scope}:${entry.name}`,
        name: name || entry.name,
        dirName: entry.name,
        description: description || 'No description provided.',
        scope,
        enabled: !isExplicitDisabled,
        path: skillPath,
        file: skillFile,
      });
    } catch (err) {
      console.error(`Error reading ${skillFile}:`, err.message);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// SidecarApp Server
// ---------------------------------------------------------------------------

const app = new SidecarApp();

app.page('/', () => readFileSync(join(HERE, 'index.html'), 'utf8'));
app.page('/app.js', () => readFileSync(join(HERE, 'app.js'), 'utf8'));
app.api('/styles.css', () => new Response(readFileSync(join(HERE, 'styles.css'), 'utf8'), { contentType: 'text/css' }), 'GET');

// GET /api/skills
app.api('/api/skills', (data) => {
  try {
    const wsRoots = parseWorkspaceRoots(data?.workspaceUris);
    const skills = [
      ...scanSkillDir(GLOBAL_SKILLS_DIR, 'global'),
      ...scanSkillDir(BUILTIN_SKILLS_DIR, 'builtin'),
    ];
    for (const wsRoot of wsRoots) {
      skills.push(...scanSkillDir(wsRoot, 'workspace'));
    }
    return jsonResponse({ skills }, 200);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}, 'GET');

// POST /api/skill/toggle
app.api('/api/skill/toggle', (data) => {
  try {
    const wsRoots = parseWorkspaceRoots(data.workspaceUris);
    const canonical = assertAllowedPath(data.path, wsRoots);

    const currentParent = dirname(canonical);
    const skillName = basename(canonical);
    let destPath;

    if (basename(currentParent) === '.disabled') {
      // Re-enable
      destPath = join(dirname(currentParent), skillName);
    } else {
      // Disable
      destPath = join(currentParent, '.disabled', skillName);
    }

    safeRename(canonical, destPath);
    const isNowEnabled = basename(dirname(destPath)) !== '.disabled';

    return jsonResponse({
      success: true,
      newPath: destPath,
      enabled: isNowEnabled,
      file: join(destPath, 'SKILL.md'),
    }, 200);
  } catch (err) {
    return jsonResponse({ error: err.message }, 400);
  }
});

// GET /api/skill/content
app.api('/api/skill/content', (data) => {
  try {
    const wsRoots = parseWorkspaceRoots(data?.workspaceUris);
    const canonical = assertAllowedPath(data.path, wsRoots);
    const targetFile = canonical.endsWith('SKILL.md') ? canonical : join(canonical, 'SKILL.md');

    if (!existsSync(targetFile)) {
      return jsonResponse({ error: 'SKILL.md file not found' }, 404);
    }

    const content = readFileSync(targetFile, 'utf8');
    return jsonResponse({ content, path: targetFile }, 200);
  } catch (err) {
    return jsonResponse({ error: err.message }, 400);
  }
}, 'GET');

// POST /api/skill/save
app.api('/api/skill/save', (data) => {
  try {
    const content = String(data.content ?? '');
    validateFrontmatter(content);

    const wsRoots = parseWorkspaceRoots(data.workspaceUris);

    if (data.path) {
      // Editing existing skill
      const canonical = assertAllowedPath(data.path, wsRoots);
      const targetFile = canonical.endsWith('SKILL.md') ? canonical : join(canonical, 'SKILL.md');
      assertAllowedPath(dirname(targetFile), wsRoots);
      writeFileSync(targetFile, content, 'utf8');
      return jsonResponse({ success: true, path: targetFile }, 200);
    }

    // Creating new skill
    const scope = data.scope || 'global';
    const name = String(data.name || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    if (!name) throw new Error("A valid skill name is required.");

    let targetDir;
    if (scope === 'workspace') {
      if (!wsRoots.length) {
        throw new Error("No active workspace found to create workspace skill.");
      }
      targetDir = join(wsRoots[0], name);
    } else {
      targetDir = join(GLOBAL_SKILLS_DIR, name);
    }

    assertAllowedPath(targetDir, wsRoots);
    mkdirSync(targetDir, { recursive: true });
    const targetFile = join(targetDir, 'SKILL.md');
    writeFileSync(targetFile, content, 'utf8');

    return jsonResponse({ success: true, path: targetFile, dir: targetDir }, 200);
  } catch (err) {
    return jsonResponse({ error: err.message }, 400);
  }
});

app.run();
