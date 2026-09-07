// github.js — GitHub REST API fetch layer + URL parsing. No dependencies.

export class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UsageError';
    this.exitCode = 1;
  }
}

export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.exitCode = 2;
  }
}

export class RateLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RateLimitError';
    this.exitCode = 3;
  }
}

export class HttpError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.exitCode = 2;
  }
}

const NAME_RE = /^[A-Za-z0-9._-]+$/;

/**
 * Parse "https://github.com/owner/repo", "owner/repo", trailing "/", ".git"
 * suffix, or URLs with extra path segments (/tree/main). Throws UsageError.
 */
export function parseRepo(input) {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new UsageError('Missing repo argument. Usage: repo-roast <github-url-or-owner/repo>');
  }
  let s = input.trim();
  s = s.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, ''); // strip protocol
  s = s.replace(/^www\./, '');
  s = s.replace(/^(?:github\.com)\//i, ''); // strip github host if present
  s = s.replace(/\/+$/, ''); // trailing slashes
  const parts = s.split('/');
  if (parts.length < 2) {
    throw new UsageError(`Could not parse "${input}" as owner/repo or a GitHub URL.`);
  }
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/, '');
  if (!NAME_RE.test(owner) || !NAME_RE.test(repo)) {
    throw new UsageError(`Invalid owner/repo in "${input}".`);
  }
  return { owner, repo };
}

export async function apiGet(path, { token, fetchImpl = fetch } = {}) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'repo-roast-cli',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetchImpl(`https://api.github.com${path}`, { headers });
  if (res.status === 404) throw new NotFoundError(`GitHub said 404 for ${path}`);
  if (res.status === 403 || res.status === 429) {
    if (res.headers?.get?.('x-ratelimit-remaining') === '0') {
      const reset = res.headers.get('x-ratelimit-reset');
      const when = reset ? new Date(Number(reset) * 1000).toLocaleString() : 'soon';
      throw new RateLimitError(
        `GitHub API rate limit exhausted (resets ${when}). Set GITHUB_TOKEN for 5000 req/hour.`
      );
    }
    throw new HttpError(`GitHub API refused the request (HTTP ${res.status}).`, res.status);
  }
  if (!res.ok) throw new HttpError(`GitHub API error (HTTP ${res.status}) for ${path}`, res.status);
  return res.json();
}

const MANIFESTS = ['package.json', 'requirements.txt', 'pyproject.toml', 'go.mod', 'Cargo.toml'];

export function parseManifest(name, raw) {
  try {
    if (name === 'package.json') {
      const j = JSON.parse(raw);
      return {
        ecosystem: 'npm',
        deps: { ...(j.dependencies || {}) },
        devDeps: { ...(j.devDependencies || {}) }
      };
    }
    if (name === 'requirements.txt') {
      const lines = raw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#') && !l.startsWith('-'));
      const deps = {};
      for (const line of lines) {
        const m = line.match(/^([A-Za-z0-9._-]+)\s*(.*)$/);
        if (m) deps[m[1]] = m[2] || 'unpinned';
      }
      return { ecosystem: 'pypi', deps, devDeps: {} };
    }
    if (name === 'go.mod') {
      const deps = {};
      const block = raw.match(/require\s*\(([\s\S]*?)\)/);
      const lines = block ? block[1].split(/\r?\n/) : [];
      for (const l of lines) {
        const m = l.trim().match(/^([^\s/]+(?:\/[^\s]+)*)\s+(v[^\s]+)/);
        if (m) deps[m[1]] = m[2];
      }
      return { ecosystem: 'go', deps, devDeps: {} };
    }
    if (name === 'Cargo.toml') {
      const deps = {};
      const sect = raw.match(/\[dependencies\]([\s\S]*?)(?:\n\[|$)/);
      if (sect) {
        for (const l of sect[1].split(/\r?\n/)) {
          const m = l.trim().match(/^([A-Za-z0-9_-]+)\s*=\s*"?([^"\n]+)"?/);
          if (m) deps[m[1]] = m[2].trim();
        }
      }
      return { ecosystem: 'crates', deps, devDeps: {} };
    }
    if (name === 'pyproject.toml') {
      const deps = {};
      const sect = raw.match(/dependencies\s*=\s*\[([\s\S]*?)\]/);
      if (sect) {
        for (const l of sect[1].split(/\r?\n/)) {
          const m = l.match(/["']([A-Za-z0-9._-]+)([^"']*)["']/);
          if (m) deps[m[1]] = m[2] || 'unpinned';
        }
      }
      return { ecosystem: 'pypi', deps, devDeps: {} };
    }
  } catch {
    return { ecosystem: 'unknown', deps: {}, devDeps: {} };
  }
  return { ecosystem: 'unknown', deps: {}, devDeps: {} };
}

/** Fetch everything the analyzer needs about owner/repo. */
export async function fetchRepoData(owner, repo, { token, fetchImpl = fetch } = {}) {
  const opts = { token, fetchImpl };
  const meta = await apiGet(`/repos/${owner}/${repo}`, opts);

  let readme = null;
  try {
    const r = await apiGet(`/repos/${owner}/${repo}/readme`, opts);
    if (r && typeof r.content === 'string') {
      readme = Buffer.from(r.content, 'base64').toString('utf8');
    }
  } catch {
    readme = null;
  }

  let rootNames = [];
  try {
    const root = await apiGet(`/repos/${owner}/${repo}/contents/`, opts);
    if (Array.isArray(root)) rootNames = root.map((f) => f.name);
  } catch {
    rootNames = [];
  }

  const branch = meta.default_branch || 'main';
  const manifestName = MANIFESTS.find((n) => rootNames.includes(n));
  let manifest = null;
  if (manifestName) {
    try {
      const res = await fetchImpl(
        `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${manifestName}`,
        { headers: { 'User-Agent': 'repo-roast-cli' } }
      );
      if (res.ok) manifest = parseManifest(manifestName, await res.text());
    } catch {
      manifest = null;
    }
  }

  let commits = [];
  try {
    commits = await apiGet(`/repos/${owner}/${repo}/commits?per_page=30`, opts);
    if (!Array.isArray(commits)) commits = [];
  } catch {
    commits = [];
  }

  let contributors = [];
  try {
    contributors = await apiGet(`/repos/${owner}/${repo}/contributors?per_page=5`, opts);
    if (!Array.isArray(contributors)) contributors = [];
  } catch {
    contributors = [];
  }

  return {
    meta,
    readme,
    rootNames,
    manifestName,
    manifest,
    commits,
    contributors,
    fetchedAt: new Date().toISOString()
  };
}
