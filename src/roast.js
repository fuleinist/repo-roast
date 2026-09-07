// roast.js — rule-based roast engine. Deterministic per repo (FNV-1a hash).

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const POOLS = {
  'readme.missing': [
    'No README. Bold strategy — letting the code speak entirely for itself. It is mumbling.',
    'A repo with no README is a restaurant with no menu. Sure, the food might be great. Might.',
    'No README found. Contributors will enjoy the archaeology dig.'
  ],
  'readme.short': [
    'The README is shorter than most commit messages. Ambitious minimalism.',
    'That README is a haiku. Beautiful. Useless.'
  ],
  'readme.no-title': [
    'The README has no title. Even the documentation has an identity crisis.'
  ],
  'readme.no-badges': [
    'Zero badges in the README. No CI status, no npm version, no "made with love". Just vibes.'
  ],
  'readme.no-install': [
    'No install section. Users are expected to guess. Some will guess `npm install`. Some will guess wrong.',
    'No install instructions. The onboarding experience is "figure it out".'
  ],
  'readme.no-usage': [
    'No usage examples. How do you use this? The README shrugs.',
    'No examples anywhere. Somewhere a user just closed the tab.'
  ],
  'readme.no-code': [
    'Not a single code block in the README. For a code project. That is a choice.'
  ],
  'readme.no-images': [
    'No screenshots, no demo GIFs. Text-only documentation in a visual world.'
  ],
  'readme.no-license-section': [
    'The README never mentions the license, so legally it does not exist. Nice.'
  ],
  'readme.no-links': [
    'No links in the README. Not to docs, not to issues, not anywhere. A documentation island.'
  ],
  'deps.none': [
    'No dependency manifest found. Either this is pure artisanal code or the project is hiding its shopping list.'
  ],
  'deps.bloat': [
    'The dependency count is in the danger zone. Every `npm install` is a small geological event.',
    'So many dependencies. The node_modules has its own gravitational pull.'
  ],
  'deps.loose': [
    'Loose version pins everywhere. Living life on the semver edge — one upstream breaking change away from chaos.'
  ],
  'deps.heavy': [
    'Dated heavyweight dependencies detected. Time travel is hard, but upgrading is harder.',
    'Still using dependencies that other projects list under "tech debt".'
  ],
  'deps.dupe': [
    'Multiple utility libraries doing the same job. Pick a side.'
  ],
  'deps.no-lockfile': [
    'No lockfile committed. Every developer gets their own surprise dependency tree. Build roulette!',
    'No lockfile. "Works on my machine" is the official release strategy.'
  ],
  'health.archived': [
    'This repo is archived. It is less a project and more a memorial.',
    'Archived. The code lives on in our hearts and in nobody’s CI.'
  ],
  'health.stale-push': [
    'The last push was ages ago. The dust has dust.',
    'This repo has been quieter than a abandoned mall food court.',
    'Nothing pushed in a long while. The maintainers are either on a legendary vacation or have ascended.'
  ],
  'health.low-cadence': [
    'Commit cadence: glacial. The project moves at the speed of continental drift.',
    'Very few recent commits. Momentum is a concept this repo has heard of.'
  ],
  'health.no-ci': [
    'No CI. Tests? Maybe. Passing? Surely. Verified? Never.',
    'No CI pipeline found. Every merge is a leap of faith.'
  ],
  'health.no-tests': [
    'No visible tests. The test suite is "the users".',
    'Zero test files. QA is performed in production, by strangers.'
  ],
  'health.issue-ratio': [
    'The open-issue-to-star ratio is concerning. More complaints than fans.'
  ],
  'gov.no-license': [
    'No license. Legally, nobody can use, copy, or fork this — including your biggest fans. Congrats on scaring away every contributor.',
    'No license file. This code is technically a state secret.',
    'Missing license: the classic "all rights reserved by accident".'
  ],
  'gov.no-contributing': [
    'No CONTRIBUTING guide. New contributors will wing it, and so will you, reviewing their PRs.'
  ],
  'gov.no-changelog': [
    'No changelog. Users learn about breaking changes by experiencing them.',
    'No CHANGELOG. Release notes are whatever the tag name says.'
  ],
  'gov.no-coc': [
    'No code of conduct. The issue tracker is a saloon with no bouncer.'
  ],
  'gov.no-description': [
    'No repo description. GitHub search found nothing, and neither will anyone else.'
  ],
  'gov.no-topics': [
    'No topics tags. Discoverability strategy: hope.'
  ],
  'gov.no-gitignore': [
    'No .gitignore. How long until node_modules gets committed? Place your bets.',
    'No .gitignore. Somewhere, a .DS_Store is being pushed right now.'
  ],
  'commits.none': [
    'Could not read the commit history. The past is a mystery.'
  ],
  'commits.lazy': [
    'The commit messages read like a text conversation: "fix", "update", "wip". Future-you is going to have questions.',
    'Commit history is mostly single-word murmurs. `git bisect` sends its regards.',
    'Commit messages like "update" tell a story. Unfortunately it is a mystery novel.'
  ]
};

export const CONGRATS = [
  'Honestly? This repo is annoyingly well put together. Hard to roast. Go touch grass.',
  'Clean README, sensible deps, real commits. Who hurt you (in a good way)?',
  'This repo has its life together. The roast engine is filing a complaint with HR.'
];

export const FIXES = {
  'readme.missing': 'Add a README.md with at least a title, what-it-does paragraph, install, and usage example.',
  'readme.short': 'Expand the README past 500 chars: add usage examples and an install section.',
  'readme.no-title': 'Give the README a top-level `# Title`.',
  'readme.no-badges': 'Add CI/version badges so visitors can see project status at a glance.',
  'readme.no-install': 'Add an "Install" section with the exact command.',
  'readme.no-usage': 'Add a "Usage" section with a runnable example.',
  'readme.no-code': 'Add fenced code blocks showing real usage.',
  'readme.no-images': 'Add a screenshot or demo GIF — visuals massively increase adoption.',
  'readme.no-license-section': 'Mention the license in the README.',
  'readme.no-links': 'Link to docs, issues, and related projects in the README.',
  'deps.none': 'If this is a code project, commit a dependency manifest (package.json / requirements.txt / etc.).',
  'deps.bloat': 'Trim the dependency tree: audit with depcheck or npm-check and remove unused packages.',
  'deps.loose': 'Pin dependency versions (exact or lockfile-enforced) to make builds reproducible.',
  'deps.heavy': 'Replace dated/heavy deps: moment→date-fns or Luxon, lodash→native ES2023+, request→fetch/undici.',
  'deps.dupe': 'Pick one utility library and drop the duplicate.',
  'deps.no-lockfile': 'Commit a lockfile (package-lock.json / yarn.lock / go.sum / Cargo.lock).',
  'health.archived': 'If the project is truly done, add a README banner pointing users to alternatives.',
  'health.stale-push': 'Push something — even a README update — or explicitly mark the project as unmaintained.',
  'health.low-cadence': 'Increase commit cadence or batch work into visible milestones so momentum shows.',
  'health.no-ci': 'Add a CI workflow (GitHub Actions) that runs tests on every push/PR.',
  'health.no-tests': 'Add a tests/ directory with at least smoke tests for the core paths.',
  'health.issue-ratio': 'Triage the backlog: close stale issues, label the rest, and pin a "good first issue".',
  'gov.no-license': 'Add a LICENSE file (MIT/Apache-2.0 are safe defaults) so people can legally use the code.',
  'gov.no-contributing': 'Add a CONTRIBUTING.md covering setup, PR flow, and issue templates.',
  'gov.no-changelog': 'Start a CHANGELOG.md (Keep a Changelog format) and update it per release.',
  'gov.no-coc': 'Add a CODE_OF_CONDUCT.md (Contributor Covenant is one command away).',
  'gov.no-description': 'Set a one-line repo description — it shows up in search and social previews.',
  'gov.no-topics': 'Add 3–6 topic tags for discoverability.',
  'gov.no-gitignore': 'Add a .gitignore for the project ecosystem.',
  'commits.none': 'Make commit history readable: allow API access or start writing real messages.',
  'commits.lazy': 'Adopt Conventional Commits (feat:/fix:/docs:) — future changelogs and bisects will thank you.'
};

/** Pick up to n deterministic roasts for failing checks, ordered by weight. */
export function pickRoasts(analysis, n = 5) {
  const failing = analysis.checks.filter((c) => !c.ok).sort((a, b) => b.weight - a.weight);
  if (failing.length === 0) {
    return [CONGRATS[hash(`${analysis.repo}:congrats`) % CONGRATS.length]];
  }
  const out = [];
  for (const check of failing) {
    if (out.length >= n) break;
    const pool = POOLS[check.id];
    if (!pool) continue;
    const line = pool[hash(`${analysis.repo}:${check.id}`) % pool.length];
    if (!out.includes(line)) out.push(line);
  }
  if (out.length === 0) out.push(POOLS['commits.lazy'][0]);
  return out.slice(0, n);
}

/** Top n actionable fixes for failing checks, ordered by weight. */
export function pickFixes(analysis, n = 5) {
  const failing = analysis.checks.filter((c) => !c.ok).sort((a, b) => b.weight - a.weight);
  const out = [];
  for (const check of failing) {
    if (out.length >= n) break;
    const fix = FIXES[check.id];
    if (fix && !out.includes(fix)) out.push(fix);
  }
  return out.slice(0, n);
}

export function buildRoast(analysis) {
  return {
    grade: analysis.grade,
    roasts: pickRoasts(analysis),
    fixes: pickFixes(analysis)
  };
}
