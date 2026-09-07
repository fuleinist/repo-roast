// analyze.js — scoring model. Pure functions over fetched repo data.

const DAY_MS = 24 * 60 * 60 * 1000;

function clamp(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function heading(readme, re) {
  return re.test(readme);
}

export function scoreReadme(readme) {
  const checks = [];
  if (!readme) {
    checks.push({ id: 'readme.missing', category: 'readme', ok: false, weight: 100, detail: 'No README found' });
    return { score: 0, checks };
  }
  const len = readme.length;
  checks.push({ id: 'readme.short', category: 'readme', ok: len >= 500, weight: 10, detail: `README is ${len} chars` });
  checks.push({ id: 'readme.no-title', category: 'readme', ok: /^#\s+\S/m.test(readme), weight: 10, detail: 'No top-level title' });
  checks.push({
    id: 'readme.no-badges', category: 'readme',
    ok: /shields\.io|badge|img\.shields|github\.com\/[^/]+\/[^/]+\/(actions|workflows)/i.test(readme),
    weight: 10, detail: 'No badges'
  });
  checks.push({ id: 'readme.no-install', category: 'readme', ok: heading(readme, /^#{1,4}\s.*(install|setup|getting started|quick start)/im), weight: 15, detail: 'No install section' });
  checks.push({ id: 'readme.no-usage', category: 'readme', ok: heading(readme, /^#{1,4}\s.*(usage|example|how to use|demo)/im) || /```[\s\S]*?```/.test(readme), weight: 15, detail: 'No usage/examples section' });
  checks.push({ id: 'readme.no-code', category: 'readme', ok: /```/.test(readme), weight: 15, detail: 'No code blocks' });
  checks.push({ id: 'readme.no-images', category: 'readme', ok: /!\[|\.png|\.gif|\.jpg|\.svg/i.test(readme), weight: 10, detail: 'No screenshots/images' });
  checks.push({ id: 'readme.no-license-section', category: 'readme', ok: heading(readme, /^#{1,4}\s.*license/im), weight: 5, detail: 'No license section in README' });
  checks.push({ id: 'readme.no-links', category: 'readme', ok: /https?:\/\//.test(readme), weight: 10, detail: 'No links at all' });

  const total = checks.reduce((s, c) => s + c.weight, 0);
  const got = checks.filter((c) => c.ok).reduce((s, c) => s + c.weight, 0);
  return { score: clamp((got / total) * 100), checks };
}

const HEAVY_PATTERNS = [
  { re: /^(lodash|underscore)$/, note: 'carrying a whole utility library' },
  { re: /^moment$/, note: 'moment.js in 2026 (deprecated — use date-fns/dayjs/Luxon)' },
  { re: /^request$/, note: 'the deprecated `request` package' },
  { re: /^left-pad$/, note: 'left-pad. Really.' }
];

export function scoreDependencies(data) {
  const checks = [];
  const { manifest, manifestName, rootNames } = data;
  if (!manifest) {
    checks.push({
      id: 'deps.none', category: 'dependencies', ok: false, weight: 50,
      detail: manifestName ? `Found ${manifestName} but could not parse it` : 'No dependency manifest detected (maybe not a code project?)'
    });
    return { score: 50, checks };
  }
  const all = { ...(manifest.deps || {}), ...(manifest.devDeps || {}) };
  const count = Object.keys(all).length;
  checks.push({ id: 'deps.bloat', category: 'dependencies', ok: count <= 20, weight: 20, detail: `${count} total dependencies` });

  const loose = Object.entries(all).filter(([, v]) => typeof v === 'string' && /^[\^~]/.test(v)).length;
  checks.push({ id: 'deps.loose', category: 'dependencies', ok: loose === 0, weight: 20, detail: `${loose} loosely-pinned (^/~) versions` });

  const heavy = Object.keys(all).filter((name) => HEAVY_PATTERNS.some((p) => p.re.test(name)));
  checks.push({ id: 'deps.heavy', category: 'dependencies', ok: heavy.length === 0, weight: 20, detail: heavy.length ? `heavy/dated deps: ${heavy.join(', ')}` : 'no heavy/dated deps' });

  const hasDupes = Object.keys(all).some((n) => /^(lodash|underscore)$/.test(n)) && Object.keys(all).some((n) => /^(ramda|remeda)$/.test(n));
  checks.push({ id: 'deps.dupe', category: 'dependencies', ok: !hasDupes, weight: 10, detail: 'multiple utility libraries doing the same job' });

  const lockfiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb', 'bun.lock', 'Poetry.lock', 'uv.lock', 'Cargo.lock', 'go.sum'];
  const hasLock = rootNames.some((n) => lockfiles.includes(n));
  checks.push({ id: 'deps.no-lockfile', category: 'dependencies', ok: hasLock, weight: 30, detail: 'No lockfile committed' });

  const total = checks.reduce((s, c) => s + c.weight, 0);
  const got = checks.filter((c) => c.ok).reduce((s, c) => s + c.weight, 0);
  return { score: clamp((got / total) * 100), checks };
}

const CI_FILES = ['.github', '.gitlab-ci.yml', '.travis.yml', '.circleci', 'Jenkinsfile', 'azure-pipelines.yml', '.woodpecker.yml'];
const TEST_HINTS = ['test', 'tests', '__tests__', 'spec', 'testing'];

export function scoreHealth(data, now = Date.now()) {
  const checks = [];
  const { meta, rootNames, commits } = data;

  if (meta.archived) {
    checks.push({ id: 'health.archived', category: 'health', ok: false, weight: 100, detail: 'Repo is archived' });
    return { score: 0, checks };
  }

  const pushedDays = meta.pushed_at ? (now - new Date(meta.pushed_at).getTime()) / DAY_MS : Infinity;
  const pushScore = pushedDays <= 30 ? 30 : pushedDays <= 90 ? 20 : pushedDays <= 365 ? 10 : 0;
  checks.push({ id: 'health.stale-push', category: 'health', ok: pushScore === 30, weight: 30, detail: pushedDays === Infinity ? 'never pushed' : `last push ${Math.round(pushedDays)} days ago`, points: pushScore });

  const recentCommits = commits.filter((c) => c?.commit?.author?.date && (now - new Date(c.commit.author.date).getTime()) / DAY_MS <= 90).length;
  const cadenceScore = recentCommits >= 10 ? 25 : recentCommits >= 3 ? 15 : recentCommits >= 1 ? 8 : 0;
  checks.push({ id: 'health.low-cadence', category: 'health', ok: recentCommits >= 10, weight: 25, detail: `${recentCommits} commits in the last 90 days`, points: cadenceScore });

  const hasCI = rootNames.some((n) => CI_FILES.includes(n));
  checks.push({ id: 'health.no-ci', category: 'health', ok: hasCI, weight: 20, detail: 'No CI configuration found' });

  const hasTests = rootNames.some((n) => TEST_HINTS.includes(n.toLowerCase())) || rootNames.some((n) => /\.(test|spec)\./i.test(n));
  checks.push({ id: 'health.no-tests', category: 'health', ok: hasTests, weight: 15, detail: 'No visible tests directory or test files' });

  const stars = meta.stargazers_count ?? 0;
  const issues = meta.open_issues_count ?? 0;
  const ratioOk = stars === 0 ? issues <= 20 : issues / Math.max(stars, 1) < 0.5;
  checks.push({ id: 'health.issue-ratio', category: 'health', ok: ratioOk, weight: 10, detail: `${issues} open issues vs ${stars} stars` });

  const got = checks.reduce((s, c) => s + (c.points !== undefined ? c.points : c.ok ? c.weight : 0), 0);
  return { score: clamp(got), checks };
}

export function scoreGovernance(data) {
  const checks = [];
  const { meta, rootNames } = data;
  const lic = meta.license && meta.license.spdx_id && meta.license.spdx_id !== 'NOASSERTION' ? meta.license.spdx_id : null;
  checks.push({ id: 'gov.no-license', category: 'governance', ok: Boolean(lic), weight: 35, detail: lic ? `License: ${lic}` : 'No detectable license (all rights reserved by default — nobody can legally use this)' });
  const has = (n) => rootNames.some((f) => f.toLowerCase() === n);
  checks.push({ id: 'gov.no-contributing', category: 'governance', ok: has('contributing.md'), weight: 15, detail: 'No CONTRIBUTING.md' });
  checks.push({ id: 'gov.no-changelog', category: 'governance', ok: has('changelog.md') || rootNames.some((f) => /^releases?$|^history$/i.test(f)), weight: 15, detail: 'No CHANGELOG' });
  checks.push({ id: 'gov.no-coc', category: 'governance', ok: has('code_of_conduct.md'), weight: 10, detail: 'No CODE_OF_CONDUCT' });
  checks.push({ id: 'gov.no-description', category: 'governance', ok: Boolean(meta.description && meta.description.trim()), weight: 10, detail: 'Repo has no description' });
  checks.push({ id: 'gov.no-topics', category: 'governance', ok: (meta.topics || []).length > 0, weight: 5, detail: 'No topics tags (discoverability: zero)' });
  checks.push({ id: 'gov.no-gitignore', category: 'governance', ok: rootNames.includes('.gitignore'), weight: 10, detail: 'No .gitignore' });

  const total = checks.reduce((s, c) => s + c.weight, 0);
  const got = checks.filter((c) => c.ok).reduce((s, c) => s + c.weight, 0);
  return { score: clamp((got / total) * 100), checks };
}

const CONVENTIONAL = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([^)]+\))?!?:\s+\S/;
const LAZY = /^(update|updates|fix|fixes|wip|changes|change|stuff|things|misc|temp|tmp|test|asdf|asdfg|\.+|x+|a+|\d+|done|stuff|minor|small fix|bugfix|fix bug|fix stuff|latest version|new version|version bump|bump)$/i;

export function isGoodCommitMessage(message) {
  if (typeof message !== 'string') return false;
  const first = message.split(/\r?\n/)[0].trim();
  if (!first) return false;
  if (CONVENTIONAL.test(first)) return true;
  if (LAZY.test(first)) return false;
  if (first.length < 10) return false;
  return true;
}

export function scoreCommits(data) {
  const checks = [];
  const messages = (data.commits || []).map((c) => c?.commit?.message).filter((m) => typeof m === 'string');
  if (messages.length === 0) {
    checks.push({ id: 'commits.none', category: 'commits', ok: false, weight: 100, detail: 'Could not read commit history', points: 50 });
    return { score: 50, checks };
  }
  const good = messages.filter(isGoodCommitMessage).length;
  const pct = Math.round((good / messages.length) * 100);
  checks.push({
    id: 'commits.lazy', category: 'commits', ok: pct >= 70, weight: 100,
    detail: `${good}/${messages.length} of the last commits have meaningful messages (${pct}%)`,
    points: pct
  });
  return { score: clamp(pct), checks };
}

export function gradeFor(score) {
  if (score >= 90) return 'S';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

const WEIGHTS = { readme: 0.25, dependencies: 0.15, health: 0.25, governance: 0.15, commits: 0.2 };

export function analyze(data) {
  const readme = scoreReadme(data.readme);
  const dependencies = scoreDependencies(data);
  const health = scoreHealth(data);
  const governance = scoreGovernance(data);
  const commits = scoreCommits(data);
  const overall = clamp(
    readme.score * WEIGHTS.readme +
      dependencies.score * WEIGHTS.dependencies +
      health.score * WEIGHTS.health +
      governance.score * WEIGHTS.governance +
      commits.score * WEIGHTS.commits
  );
  return {
    repo: `${data.meta.owner?.login ?? data.meta.full_name?.split('/')[0] ?? '?'}/${data.meta.name ?? '?'}`,
    fullName: data.meta.full_name || null,
    fetchedAt: data.fetchedAt,
    meta: {
      stars: data.meta.stargazers_count ?? 0,
      forks: data.meta.forks_count ?? 0,
      openIssues: data.meta.open_issues_count ?? 0,
      language: data.meta.language || null,
      archived: Boolean(data.meta.archived),
      created: data.meta.created_at || null,
      pushed: data.meta.pushed_at || null,
      description: data.meta.description || null,
      contributors: (data.contributors || []).length
    },
    scores: {
      readme: readme.score,
      dependencies: dependencies.score,
      health: health.score,
      governance: governance.score,
      commits: commits.score,
      overall
    },
    grade: gradeFor(overall),
    checks: [...readme.checks, ...dependencies.checks, ...health.checks, ...governance.checks, ...commits.checks]
  };
}
