import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRepo, parseManifest, UsageError } from '../src/github.js';

test('parses owner/repo', () => {
  assert.deepEqual(parseRepo('owner/repo'), { owner: 'owner', repo: 'repo' });
});

test('parses full GitHub URL', () => {
  assert.deepEqual(parseRepo('https://github.com/fuleinist/repo-roast'), {
    owner: 'fuleinist',
    repo: 'repo-roast'
  });
});

test('parses URL with trailing slash', () => {
  assert.deepEqual(parseRepo('https://github.com/owner/repo/'), { owner: 'owner', repo: 'repo' });
});

test('parses URL with .git suffix', () => {
  assert.deepEqual(parseRepo('https://github.com/owner/repo.git'), { owner: 'owner', repo: 'repo' });
  assert.deepEqual(parseRepo('owner/repo.git'), { owner: 'owner', repo: 'repo' });
});

test('parses URL with extra path segments', () => {
  assert.deepEqual(parseRepo('https://github.com/owner/repo/tree/main'), { owner: 'owner', repo: 'repo' });
});

test('handles dots and dashes in names', () => {
  assert.deepEqual(parseRepo('my-org/my.repo-v2'), { owner: 'my-org', repo: 'my.repo-v2' });
});

test('rejects garbage', () => {
  for (const bad of ['', '   ', 'onlyone', null, undefined, 42, 'a//b', 'sp ace/repo']) {
    assert.throws(() => parseRepo(bad), UsageError, `should reject ${JSON.stringify(bad)}`);
  }
});

test('parseManifest package.json', () => {
  const m = parseManifest('package.json', JSON.stringify({ dependencies: { a: '^1.0.0' }, devDependencies: { b: '2.0.0' } }));
  assert.equal(m.ecosystem, 'npm');
  assert.deepEqual(m.deps, { a: '^1.0.0' });
  assert.deepEqual(m.devDeps, { b: '2.0.0' });
});

test('parseManifest requirements.txt', () => {
  const m = parseManifest('requirements.txt', '# comment\nflask==2.0\nrequests>=2\n\n-r other.txt\n');
  assert.equal(m.ecosystem, 'pypi');
  assert.deepEqual(m.deps, { flask: '==2.0', requests: '>=2' });
});

test('parseManifest handles broken JSON gracefully', () => {
  const m = parseManifest('package.json', '{not json');
  assert.equal(m.ecosystem, 'unknown');
});
