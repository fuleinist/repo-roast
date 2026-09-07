import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderJson, renderMarkdown, renderTerminal } from '../src/format.js';

const analysis = {
  repo: 'owner/repo',
  fetchedAt: '2026-09-07T12:00:00Z',
  meta: { stars: 10, forks: 2, openIssues: 1, language: 'JavaScript', archived: false, created: null, pushed: null, description: 'x', contributors: 1 },
  scores: { readme: 40, dependencies: 50, health: 30, governance: 65, commits: 80, overall: 50 },
  grade: 'D',
  checks: []
};

const roast = {
  verdict: 'A work in progress. Emphasis on progress-less.',
  roasts: ['No CI. Tests? Maybe.', 'The README is a haiku.'],
  fixes: ['Add a CI workflow.', 'Expand the README.']
};

test('renderJson emits valid JSON with required keys', () => {
  const j = JSON.parse(renderJson(analysis, roast));
  for (const k of ['repo', 'fetchedAt', 'scores', 'grade', 'roasts', 'fixes']) {
    assert.ok(k in j, `missing key ${k}`);
  }
  for (const s of ['readme', 'dependencies', 'health', 'governance', 'commits', 'overall']) {
    assert.ok(s in j.scores);
  }
  assert.equal(j.llm, false);
});

test('renderMarkdown contains grade, repo, tables, roasts and fixes', () => {
  const md = renderMarkdown(analysis, roast);
  assert.ok(md.includes('owner/repo'));
  assert.ok(md.includes('**Grade: D — 50/100**'));
  assert.ok(md.includes('| README | 40/100 |'));
  assert.ok(md.includes('No CI. Tests? Maybe.'));
  assert.ok(md.includes('1. Add a CI workflow.'));
});

test('renderTerminal contains bars and sections', () => {
  const t = renderTerminal(analysis, roast);
  assert.ok(t.includes('█'));
  assert.ok(t.includes('THE ROAST'));
  assert.ok(t.includes('THE FIXES'));
  assert.ok(t.includes('GRADE:'));
});

test('llm flag propagates to renderers', () => {
  const j = JSON.parse(renderJson(analysis, roast, { llm: true }));
  assert.equal(j.llm, true);
  assert.ok(renderMarkdown(analysis, roast, { llm: true }).includes('LLM mode'));
});
