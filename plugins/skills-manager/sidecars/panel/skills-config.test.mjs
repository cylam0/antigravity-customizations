import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  normalizeFsPath,
  readSkillsConfig,
  writeSkillsConfig,
  findStoreEntry,
  getExcludedSkills,
  setSkillExcluded,
} from './skills-config.mjs';

test('normalizeFsPath standardizes paths and expands tilde', () => {
  const p1 = normalizeFsPath('~/.gemini/config/skills-store');
  const p2 = normalizeFsPath('~\\..\\..');
  assert.ok(p1.length > 0);
  assert.ok(!p1.startsWith('~'));
});

test('readSkillsConfig handles missing file gracefully', () => {
  const missingPath = join(tmpdir(), 'non-existent-skills-' + Date.now() + '.json');
  const config = readSkillsConfig(missingPath);
  assert.deepEqual(config, { entries: [] });
});

test('writeSkillsConfig and readSkillsConfig round-trip', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'skills-cfg-test-'));
  const configPath = join(tempDir, 'skills.json');
  try {
    const original = {
      entries: [
        {
          path: '~/skills-store',
          exclude: ['skill-a', 'skill-b'],
        },
      ],
    };
    writeSkillsConfig(configPath, original);
    assert.ok(existsSync(configPath));
    const loaded = readSkillsConfig(configPath);
    assert.deepEqual(loaded, original);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('setSkillExcluded adds and removes skill exclusions correctly', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'skills-cfg-test-'));
  const configPath = join(tempDir, 'skills.json');
  const storePath = join(tempDir, 'skills-store');
  try {
    // Initial: exclude skill-1
    const res1 = setSkillExcluded(configPath, storePath, 'skill-1', true);
    assert.equal(res1.excluded, true);
    assert.deepEqual(res1.excludeList, ['skill-1']);

    let excluded = getExcludedSkills(configPath, storePath);
    assert.equal(excluded.has('skill-1'), true);
    assert.equal(excluded.has('skill-2'), false);

    // Add skill-2
    const res2 = setSkillExcluded(configPath, storePath, 'skill-2', true);
    assert.deepEqual(res2.excludeList, ['skill-1', 'skill-2']);

    // Re-enable skill-1 (exclude = false)
    const res3 = setSkillExcluded(configPath, storePath, 'skill-1', false);
    assert.equal(res3.excluded, false);
    assert.deepEqual(res3.excludeList, ['skill-2']);

    excluded = getExcludedSkills(configPath, storePath);
    assert.equal(excluded.has('skill-1'), false);
    assert.equal(excluded.has('skill-2'), true);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
