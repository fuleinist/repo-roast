import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRoast, pickRoasts, pickFixes, POOLS, FIXES } from '../src/roast.js';

const analysis = {
  repo: 'owner/repo',
  grade: 'D',
  scores: { overall: 55 },
  checks: [
    { id: 'gov.no-license', category: 'governance', ok: false, weight: 35, detail: 'No license' },
    { id: 'readme.missing', category: 'readme', ok: false, weight: 100, detail: 'No README' },
    { id: 'health.no-ci', category: 'health', ok: false, weight: 20, detail: 'No CI' },
    { id: 'readme.short', category: 'readme', ok: true, weight: 10, detail: 'fine' }
  ]
};

const cleanAnalysis = {
  repo: 'star/pupil',
  grade: 'S',
  scores: { overall: 95 },
  checks: [{ id: 'readme.short', category: 'readme', ok: true, weight: 10, detail: 'fine' }]
};

test('roasts are deterministic for the same repo', () => {
  const a = pickRoasts(analysis);
  const b = pickRoasts(analysis);
  assert.deepEqual(a, b);
});

test('roasts capped at n and ordered by weight', () => {
  const r = pickRoasts(analysis, 5);
  assert.ok(r.length <= 5 && r.length >= 2);
  // highest-weight failure (readme.missing, 100) comes first
  assert.ok(POOLS['readme.missing'].includes(r[0]));
});

test('fixes are actionable strings ordered by weight', () => {
  const f = pickFixes(analysis, 5);
  assert.ok(f.length >= 2);
  assert.equal(f[0], FIXES['readme.missing']);
});

test('clean repo gets a congratulatory roast', () => {
  const r = pickRoasts(cleanAnalysis);
  assert.equal(r.length, 1);
  assert.ok(r[0].length > 10);
});

test('buildRoast shape', () => {
  const roast = buildRoast(analysis);
  assert.equal(roast.grade, 'D');
  assert.ok(Array.isArray(roast.roasts));
  assert.ok(Array.isArray(roast.fixes));
});

test('every failing-check id has a pool and a fix', () => {
  for (const id of Object.keys(FIXES)) {
    assert.ok(POOLS[id], `missing roast pool for ${id}`);
  }
});
