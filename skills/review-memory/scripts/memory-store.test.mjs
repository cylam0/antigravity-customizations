import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveRepoSlug,
  sanitizeBranch,
  computeAnchorSignature,
  saveSession,
  recordDecision,
  revokeDecision,
  addConvention,
  queryMemory
} from './memory-store.mjs';

test('resolveRepoSlug: handles git remote url and path hashing', () => {
  const slugRemote = resolveRepoSlug('C:/some/path', 'git@github.com:cylam0/antigravity.git');
  assert.equal(slugRemote, 'github.com_cylam0_antigravity');

  const slugLocalA = resolveRepoSlug('C:/projects/app');
  const slugLocalB = resolveRepoSlug('C:/other/app');
  assert.match(slugLocalA, /^app_[a-f0-9]{8}$/);
  assert.notEqual(slugLocalA, slugLocalB, 'Different directories with same basename must produce different slugs');
});

test('sanitizeBranch: sanitizes slashes and illegal Windows path characters', () => {
  assert.equal(sanitizeBranch('feature/auth-v2'), 'feature__auth-v2');
  assert.equal(sanitizeBranch('fix:issue#123'), 'fix__issue__123');
  assert.equal(sanitizeBranch('detached_1a2b3c'), 'detached_1a2b3c');
});

test('computeAnchorSignature: line-shift resilient and stable', () => {
  const sig1 = computeAnchorSignature('src/auth.ts', 'logic', '  if (!user) return null; ', 'Missing null check');
  const sig2 = computeAnchorSignature('src/auth.ts', 'logic', 'if (!user) return null;', 'missing null check');
  assert.equal(sig1, sig2, 'Normalized signatures must match despite whitespace or casing differences');

  const sigOther = computeAnchorSignature('src/auth.ts', 'logic', 'if (!token) return;', 'Missing token');
  assert.notEqual(sig1, sigOther);
});

test('decision lifecycle: saveSession -> recordDecision -> queryMemory -> revokeDecision', async () => {
  const mockRepo = 'C:/mock/repo-alpha';
  const branchA = 'feat/branch-a';
  const branchB = 'feat/branch-b';

  const mockFindings = [
    { id: 'REV-1', file: 'src/api.ts', type: 'security', snippet: 'query(sql)', message: 'SQL injection risk' },
    { id: 'REV-2', file: 'src/util.ts', type: 'simplification', snippet: 'lodash.clone(x)', message: 'Use native structuredClone' }
  ];

  // 1. Save session
  await saveSession(mockFindings, mockRepo, branchA);

  // 2. Dismiss REV-1 with rationale on branchA
  const recordRes = await recordDecision({
    id: 'REV-1',
    status: 'dismissed',
    rationale: 'Internal trusted query; sanitized upstream',
    repoPath: mockRepo,
    branch: branchA
  });
  assert.equal(recordRes.success, true);

  // 3. Query branchA -> REV-1 signature must be in dismissed list
  const qA = await queryMemory({ repoPath: mockRepo, branch: branchA });
  assert.equal(qA.dismissed.length >= 1, true);
  const dismissedItem = qA.dismissed.find(d => d.id === 'REV-1');
  assert.ok(dismissedItem);
  assert.match(dismissedItem.rationale, /sanitized upstream/);

  // 4. Query branchB -> Branch sensitivity check: REV-1 must NOT be dismissed on branchB
  const qB = await queryMemory({ repoPath: mockRepo, branch: branchB });
  const onBranchB = qB.dismissed.find(d => d.id === 'REV-1');
  assert.equal(onBranchB, undefined, 'Branch dismissal must not leak to other branches');

  // 5. Revoke decision for REV-1 on branchA
  const revokeRes = await revokeDecision({ id: 'REV-1', repoPath: mockRepo, branch: branchA });
  assert.equal(revokeRes.success, true);
  const qRevoked = await queryMemory({ repoPath: mockRepo, branch: branchA });
  assert.equal(qRevoked.dismissed.find(d => d.id === 'REV-1'), undefined);
});

test('conventions: addConvention and file extension filtering', async () => {
  const mockRepo = 'C:/mock/repo-alpha';
  await addConvention({
    repoPath: mockRepo,
    rule: 'Always use node:fs/promises rather than raw fs',
    tags: ['fs', 'nodejs', 'ts'],
    source: 'PR #42'
  });

  // Query with matching file extension
  const qMatching = await queryMemory({ repoPath: mockRepo, files: ['src/file.ts'] });
  assert.equal(qMatching.activeConventions.some(c => c.rule.includes('node:fs/promises')), true);

  // Query with unrelated file
  const qUnrelated = await queryMemory({ repoPath: mockRepo, files: ['styles/main.css'] });
  assert.equal(qUnrelated.activeConventions.some(c => c.rule.includes('node:fs/promises')), false);
});
