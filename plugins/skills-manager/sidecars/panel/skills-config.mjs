import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, normalize, resolve } from 'node:path';

const HOME = homedir();

/**
 * Normalizes a file or directory path for cross-platform comparison.
 * Expands '~' to the user's home directory and standardizes separators.
 *
 * @param {string} p
 * @returns {string}
 */
export function normalizeFsPath(p) {
  if (!p) return '';
  let str = String(p).trim();
  if (str === '~' || str.startsWith('~/') || str.startsWith('~\\')) {
    str = HOME + str.slice(1);
  }
  const resolved = resolve(normalize(str));
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

/**
 * Reads a skills.json configuration file.
 * Returns a valid { entries: [] } object if the file doesn't exist or is empty.
 *
 * @param {string} configPath
 * @returns {object}
 */
export function readSkillsConfig(configPath) {
  if (!existsSync(configPath)) {
    return { entries: [] };
  }
  try {
    const raw = readFileSync(configPath, 'utf8').trim();
    if (!raw) return { entries: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { entries: [] };
    }
    if (!Array.isArray(parsed.entries)) {
      parsed.entries = [];
    }
    return parsed;
  } catch (err) {
    console.error(`Error parsing ${configPath}:`, err.message);
    return { entries: [] };
  }
}

/**
 * Writes a skills.json configuration file cleanly.
 *
 * @param {string} configPath
 * @param {object} config
 */
export function writeSkillsConfig(configPath, config) {
  mkdirSync(dirname(configPath), { recursive: true });
  const content = JSON.stringify(config, null, 2) + '\n';
  writeFileSync(configPath, content, 'utf8');
}

/**
 * Finds the entry in skills.json corresponding to a target skill directory/store.
 *
 * @param {object} config
 * @param {string} targetStorePath
 * @returns {object|null}
 */
export function findStoreEntry(config, targetStorePath) {
  if (!config || !Array.isArray(config.entries)) return null;
  const targetNorm = normalizeFsPath(targetStorePath);
  for (const entry of config.entries) {
    if (entry && entry.path && normalizeFsPath(entry.path) === targetNorm) {
      return entry;
    }
  }
  return null;
}

/**
 * Gets the set of excluded skill names for a given skill store.
 *
 * @param {string} configPath
 * @param {string} targetStorePath
 * @returns {Set<string>}
 */
export function getExcludedSkills(configPath, targetStorePath) {
  const config = readSkillsConfig(configPath);
  const entry = findStoreEntry(config, targetStorePath);
  if (!entry || !Array.isArray(entry.exclude)) {
    return new Set();
  }
  return new Set(entry.exclude.map(s => String(s).trim()).filter(Boolean));
}

/**
 * Toggles a skill's exclusion state in skills.json.
 * If shouldExclude is true, adds skillName to the exclude list.
 * If shouldExclude is false, removes skillName from the exclude list.
 *
 * @param {string} configPath
 * @param {string} targetStorePath
 * @param {string} skillName
 * @param {boolean} shouldExclude
 * @returns {{ excluded: boolean, excludeList: string[] }}
 */
export function setSkillExcluded(configPath, targetStorePath, skillName, shouldExclude) {
  const config = readSkillsConfig(configPath);
  let entry = findStoreEntry(config, targetStorePath);

  if (!entry) {
    entry = {
      path: targetStorePath.replace(/\\/g, '/'),
      exclude: [],
    };
    config.entries.push(entry);
  }

  if (!Array.isArray(entry.exclude)) {
    entry.exclude = [];
  }

  const existingSet = new Set(entry.exclude.map(s => String(s).trim()));

  if (shouldExclude) {
    existingSet.add(skillName);
  } else {
    existingSet.delete(skillName);
  }

  entry.exclude = Array.from(existingSet).sort();
  writeSkillsConfig(configPath, config);

  return {
    excluded: shouldExclude,
    excludeList: entry.exclude,
  };
}
