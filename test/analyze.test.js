import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, scoreReadme, scoreCommits, isGoodCommitMessage, gradeFor } from '../src/analyze.js';

const GOOD_README = `# Cool Project

![CI](https://img.shields.io/badge/ci-passing-green)

A cool project that does cool things. It has lots of text so that the length
check passes comfortably. More words here to pad it out past the minimum
threshold of five hundred characters because a README this short would be a
tragedy in the eyes of the scoring engine, so we keep typing until we are safe.

## Install

\`\`\`bash
npm install cool-project
\`\`\`

## Usage

\`\`\`js
import { cool } from 'cool-project';
cool();
\`\`\`

![screenshot](demo.png)

## License

MIT. See https://example.com for more.
`;

function fixture(overrides = {}) {
  const now = new Date();
  return {
    meta: {
      full_name: 'owner/repo',
      name: 'repo',
      owner: { login: 'owner' },
      stargazers_count: 100,
      forks_count: 10,
      open_issues_count: 5,
      language: 'JavaScript',
      archived: false,
      created_at: '2024-01-01T00:00:00Z',
      pushed_at: now.toISOString(),
      description: 'A cool repo',
      license: { spdx_id: 'MIT' },
      topics: ['cli'],
      default_branch: 'main',
      ...overrides.meta
    },
    readme: overrides.readme !== undefined ? overrides.readme : GOOD_README,
    rootNames: overrides.rootNames || [
      'README.md', 'package.json', 'package-lock.json', 'LICENSE', '.gitignore',
      '.github', 'test', 'src', 'CONTRIBUTING.md', 'CHANGELOG.md', 'CODE_OF_CONDUCT.md'
    ],
    manifestName: overrides.manifestName !== undefined ? overrides.manifestName : 'package.json',
    manifest: overrides.manifest !== undefined ? overrides.manifest : { ecosystem: 'npm', deps: { a: '1.0.0' }, devDeps: {} },
    commits: overrides.commits || Array.from({ length: 30 }, (_, i) => ({
      commit: { message: `feat: add thing ${i}`, author: { date: now.toISOString() } }
    })),
    contributors: overrides.contributors || [{ login: 'owner' }],
    fetchedAt: now.toISOString()
  };
}

test('perfect fixture scores high', () => {
  const a = analyze(fixture());
  assert.ok(a.scores.overall >= 90, `overall ${a.scores.overall} should be >= 90`);
  assert.equal(a.grade, 'S');
});

test('missing README scores readme 0 and fails readme.missing', () => {
  const r = scoreReadme(null);
  assert.equal(r.score, 0);
  assert.ok(r.checks.some((c) => c.id === 'readme.missing' && !c.ok));
});

test('good README scores high', () => {
  const r = scoreReadme(GOOD_README);
  assert.ok(r.score >= 90, `readme score ${r.score}`);
});

test('archived repo gets health 0', () => {
  const a = analyze(fixture({ meta: { archived: true } }));
  assert.equal(a.scores.health, 0);
  assert.ok(a.checks.some((c) => c.id === 'health.archived' && !c.ok));
});

test('no manifest gives dependencies score 50', () => {
  const a = analyze(fixture({ manifest: null, manifestName: null }));
  assert.equal(a.scores.dependencies, 50);
});

test('commit message quality', () => {
  assert.ok(isGoodCommitMessage('feat(cli): add --json flag'));
  assert.ok(isGoodCommitMessage('Rewrite the parser to handle edge cases'));
  assert.ok(!isGoodCommitMessage('update'));
  assert.ok(!isGoodCommitMessage('wip'));
  assert.ok(!isGoodCommitMessage('fix'));
  assert.ok(!isGoodCommitMessage(''));
  assert.ok(!isGoodCommitMessage(null));
});

test('lazy commits tank the commits score', () => {
  const commits = Array.from({ length: 30 }, () => ({
    commit: { message: 'update', author: { date: new Date().toISOString() } }
  }));
  const s = scoreCommits({ commits });
  assert.equal(s.score, 0);
});

test('grades map correctly', () => {
  assert.equal(gradeFor(95), 'S');
  assert.equal(gradeFor(85), 'A');
  assert.equal(gradeFor(75), 'B');
  assert.equal(gradeFor(65), 'C');
  assert.equal(gradeFor(55), 'D');
  assert.equal(gradeFor(20), 'F');
});

test('analyze output shape', () => {
  const a = analyze(fixture());
  assert.equal(a.repo, 'owner/repo');
  for (const k of ['readme', 'dependencies', 'health', 'governance', 'commits', 'overall']) {
    assert.equal(typeof a.scores[k], 'number');
    assert.ok(a.scores[k] >= 0 && a.scores[k] <= 100);
  }
  assert.ok(Array.isArray(a.checks) && a.checks.length > 0);
});
