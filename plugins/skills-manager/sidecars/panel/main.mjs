import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Response, SidecarApp } from 'sidecar_sdk';
import {
  getExcludedSkills,
  normalizeFsPath,
  setSkillExcluded,
} from './skills-config.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const HOME = homedir();
const GLOBAL_SKILLS_STORE_DIR = join(HOME, '.gemini', 'config', 'skills-store');
const GLOBAL_SKILLS_LEGACY_DIR = join(HOME, '.gemini', 'config', 'skills');
const GLOBAL_SKILLS_CONFIG = join(HOME, '.gemini', 'config', 'skills.json');
const BUILTIN_SKILLS_DIR = join(HOME, '.gemini', 'antigravity', 'builtin', 'skills');

const STANDARD_ROOTS = [GLOBAL_SKILLS_STORE_DIR, GLOBAL_SKILLS_LEGACY_DIR, BUILTIN_SKILLS_DIR];

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

function scanSkillDir(baseDir, scope, excludedSet = new Set()) {
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
    if (entry.name.startsWith('.')) continue;

    const skillPath = join(baseDir, entry.name);
    const skillFile = join(skillPath, 'SKILL.md');
    if (!existsSync(skillFile)) continue;

    try {
      const content = readFileSync(skillFile, 'utf8');
      const { name, description } = extractMetadata(content);
      const isExcluded = excludedSet.has(entry.name) || (name && excludedSet.has(name));
      results.push({
        id: `${scope}:${entry.name}`,
        name: name || entry.name,
        dirName: entry.name,
        description: description || 'No description provided.',
        scope,
        enabled: !isExcluded,
        path: skillPath,
        file: skillFile,
        storePath: baseDir,
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
    const globalExcluded = getExcludedSkills(GLOBAL_SKILLS_CONFIG, GLOBAL_SKILLS_STORE_DIR);

    // Primary: global skills store
    const skills = [
      ...scanSkillDir(GLOBAL_SKILLS_STORE_DIR, 'global', globalExcluded),
    ];

    // Fallback: legacy global skills directory if not yet migrated or present
    if (existsSync(GLOBAL_SKILLS_LEGACY_DIR)) {
      const legacyExcluded = getExcludedSkills(GLOBAL_SKILLS_CONFIG, GLOBAL_SKILLS_LEGACY_DIR);
      const legacySkills = scanSkillDir(GLOBAL_SKILLS_LEGACY_DIR, 'global', legacyExcluded);
      for (const ls of legacySkills) {
        if (!skills.some(s => s.dirName === ls.dirName)) {
          skills.push(ls);
        }
      }
    }

    // Built-in skills (immutable in skills.json)
    skills.push(...scanSkillDir(BUILTIN_SKILLS_DIR, 'builtin', new Set()));

    // Workspace skills
    for (const wsRoot of wsRoots) {
      const wsConfig = join(dirname(wsRoot), 'skills.json');
      const wsExcluded = getExcludedSkills(wsConfig, wsRoot);
      skills.push(...scanSkillDir(wsRoot, 'workspace', wsExcluded));
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

    const skillName = basename(canonical);
    const storeDir = dirname(canonical);

    // Guard: Built-in skills cannot be excluded via skills.json
    if (normalizeFsPath(storeDir) === normalizeFsPath(BUILTIN_SKILLS_DIR)) {
      throw new Error(`Built-in system skills are managed directly by Antigravity and cannot be disabled via skills.json.`);
    }

    // Determine target skills.json
    let configPath = GLOBAL_SKILLS_CONFIG;
    if (wsRoots.some(ws => normalizeFsPath(storeDir) === normalizeFsPath(ws))) {
      configPath = join(dirname(storeDir), 'skills.json');
    }

    const currentExcluded = getExcludedSkills(configPath, storeDir);
    const isCurrentlyExcluded = currentExcluded.has(skillName);
    const nextShouldExclude = !isCurrentlyExcluded;

    setSkillExcluded(configPath, storeDir, skillName, nextShouldExclude);
    const isNowEnabled = !nextShouldExclude;

    return jsonResponse({
      success: true,
      newPath: canonical,
      enabled: isNowEnabled,
      file: join(canonical, 'SKILL.md'),
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
    let storeDir;
    let configPath;

    if (scope === 'workspace') {
      if (!wsRoots.length) {
        throw new Error("No active workspace found to create workspace skill.");
      }
      storeDir = wsRoots[0];
      targetDir = join(storeDir, name);
      configPath = join(dirname(storeDir), 'skills.json');
    } else {
      storeDir = GLOBAL_SKILLS_STORE_DIR;
      targetDir = join(storeDir, name);
      configPath = GLOBAL_SKILLS_CONFIG;
    }

    assertAllowedPath(targetDir, wsRoots);
    mkdirSync(targetDir, { recursive: true });
    const targetFile = join(targetDir, 'SKILL.md');
    writeFileSync(targetFile, content, 'utf8');

    // Ensure new skill is not excluded
    setSkillExcluded(configPath, storeDir, name, false);

    return jsonResponse({ success: true, path: targetFile, dir: targetDir }, 200);
  } catch (err) {
    return jsonResponse({ error: err.message }, 400);
  }
});

app.run();
