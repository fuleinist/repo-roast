# repo-roast — SPEC

Paste any GitHub URL, get an AI-powered roast of the repo: code quality, README score, dependency hygiene, license issues, and actionable improvement suggestions.

## Goals

- Zero-install feel: `npx repo-roast <url>` just works.
- Works WITHOUT any API key (rule-based roast engine).
- Optional LLM mode for custom, funnier, sharper roasts when `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` is set.
- Shareable output: terminal (ANSI), `--json`, `--markdown`.

## Non-goals (v1)

- No web app / Next.js frontend (CLI first; web can come later).
- No deep static analysis of source code (metadata + file-level heuristics only).
- No cloning repos locally (GitHub API only).

## CLI Interface

```
repo-roast <github-url-or-owner/repo> [options]

Arguments:
  repo            GitHub URL (https://github.com/owner/repo) or "owner/repo"

Options:
  --json          Output roast as JSON
  --markdown      Output roast as Markdown (for sharing/pasting)
  --llm           Force LLM roast (requires ANTHROPIC_API_KEY or OPENAI_API_KEY)
  --no-llm        Force rule-based roast even if API keys are present
  --token <t>     GitHub token (default: env GITHUB_TOKEN / GH_TOKEN)
  --help          Show help
  --version       Show version
```

Exit codes: 0 success, 1 usage/input error, 2 repo not found/API error, 3 rate limited.

## Data Collection (GitHub REST API, unauthenticated OK)

For `owner/repo`, fetch:
1. `GET /repos/{owner}/{repo}` — stars, forks, open issues, pushed_at, created_at, language, size, license, archived, default_branch, description, topics.
2. `GET /repos/{owner}/{repo}/readme` — decode base64 content.
3. `GET /repos/{owner}/{repo}/contents/` (root tree) — presence of: package.json, requirements.txt, pyproject.toml, go.mod, Cargo.toml, Dockerfile, docker-compose, .gitignore, LICENSE, tests/ or test files, .github/workflows (CI), CONTRIBUTING.md, CHANGELOG.md.
4. If dependency manifest found at root, fetch and parse it (package.json dependencies+devDependencies, requirements.txt lines, etc.).
5. `GET /repos/{owner}/{repo}/commits?per_page=30` — recent commit activity, message quality (conventional commits? "fix"? "update"?).
6. `GET /repos/{owner}/{repo}/contributors?per_page=5` — bus factor.

Rate-limit awareness: detect 403/429 with `X-RateLimit-Remaining: 0`, print clear message, exit 3.

## Scoring Model (0–100 each)

1. **README score** — length, presence of: title, badges, install section, usage/examples, code blocks, screenshots, license section. Weighted checklist.
2. **Dependency hygiene** — count of deps (bloat), pinned vs loose versions, manifest present at all, lockfile present, known heavy/duplicate patterns (e.g., both lodash and ramda; moment in 2026).
3. **Project health** — last push recency, commit cadence (commits in last 90 days), open-issue-to-star ratio, archived flag, CI presence, tests presence.
4. **License & governance** — license present and OSI-ish, CONTRIBUTING, CODE_OF_CONDUCT, CHANGELOG.
5. **Commit message quality** — % conventional/meaningful vs "update"/"fix"/"wip"/single-word messages from last 30 commits.

Overall score = weighted average. Grade: S (90+), A (80+), B (70+), C (60+), D (50+), F (<50).

## Rule-Based Roast Engine

For each check that fails, a pool of 2–4 snarky one-liners is available; pick deterministically (hash of repo name) so output is stable per repo. Include:
- Verdict header with overall grade and score.
- Per-category score bars (terminal) / numbers (json/md).
- Top 5 roasts (the funniest applicable one-liners).
- Top 5 actionable fixes (concrete: "Add a LICENSE file", "Pin your 14 loose dependencies", "Your last commit was 400 days ago — declare it dead or push something").

Tone: playful, never mean-spirited about people; roast the repo, not the author.

## LLM Mode (--llm or auto when key present)

- Build a compact JSON digest of all collected facts + scores.
- Send to Anthropic (`claude-sonnet` class model via Messages API) or OpenAI (chat completions), whichever key is available (Anthropic preferred).
- System prompt: "You are a ruthless but constructive code reviewer roasting a GitHub repo. Use the provided facts JSON. Be funny, specific, cite numbers. End with 5 actionable fixes. Never invent facts not in the JSON."
- Parse response into the same output shape (verdict, roasts[], fixes[]); scores always come from the rule engine, never the LLM.
- Network calls via built-in `fetch` (Node 18+). No SDK dependencies.
- On LLM failure: warn, fall back to rule-based roast.

## Dependencies (runtime)

Target ZERO runtime dependencies (Node >= 20 built-ins only: fetch, node:util, node:crypto, process.argv parsing hand-rolled or via node:util parseArgs). Dev-only: none required; tests use `node:test`.

## Project Layout

```
repo-roast/
  package.json        (bin: repo-roast -> src/cli.js, type: module)
  src/
    cli.js            (arg parsing, orchestration, exit codes)
    github.js         (API fetch layer, rate-limit handling)
    analyze.js        (scoring model, pure functions over fetched data)
    roast.js          (rule-based roast engine, one-liner pools)
    llm.js            (optional LLM roast, digest building, fallback)
    format.js         (terminal/ANSI, JSON, Markdown renderers)
  test/
    analyze.test.js   (scoring fixtures)
    roast.test.js     (deterministic roast selection)
    format.test.js    (renderer snapshots)
    github.test.js    (URL parsing: full URLs, owner/repo, trailing slashes, .git suffix)
  README.md           (install, usage, example roast output, how scoring works)
  LICENSE             (MIT)
  .gitignore
```

## Acceptance Criteria

1. `node src/cli.js fuleinist/repo-roast` prints a full roast with grade, category scores, roasts, fixes; exit 0.
2. Full GitHub URLs, `owner/repo`, trailing `/`, and `.git` suffix all parse correctly (tested).
3. `--json` emits valid JSON with keys: repo, fetchedAt, scores{readme,dependencies,health,governance,commits,overall}, grade, roasts[], fixes[].
4. `--markdown` emits a self-contained shareable Markdown block.
5. Nonexistent repo → clean error message, exit 2 (no stack trace).
6. `node --test` passes, covering analyze, roast determinism, URL parsing, and formatters (with fixture data, no live API in tests).
7. Zero runtime dependencies in package.json.
8. README.md contains install, usage, real example output, scoring explanation, and license section.
9. LLM mode degrades gracefully: no key → rule-based; key + failure → warn + rule-based.
10. Works on Windows and POSIX (no shell-specific code).

## Build Loop Rules

- Each cycle: implement → run tests → fix → commit.
- Commit messages: conventional commits (feat:, fix:, test:, docs:).
- Never delete working code without committing first.
