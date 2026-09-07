# 🔥 repo-roast

Paste any GitHub URL, get an AI-powered roast of the repo — code quality, README score, dependency hygiene, license issues, and actionable improvement suggestions.

**Zero runtime dependencies. Zero API keys required.** Node >= 20.

```
🔥 Roasting fuleinist/repo-roast …

  🔥 R E P O - R O A S T 🔥   fuleinist/repo-roast
  ──────────────────────────────────────────────

  README         ██████████ 100/100
  Dependencies   ██████████ 100/100
  Health         ████████░░  80/100
  Governance     ███████░░░  70/100
  Commits        ██████████ 100/100
  ──────────────────────────────────────────────
  OVERALL        █████████░  90/100   GRADE: S

  🍖 THE ROAST
   • Honestly? This repo is annoyingly well put together. Hard to roast.

  🔧 THE FIXES
   1. Add 3–6 topic tags for discoverability.
```

## Install

```bash
npm install -g repo-roast
# or, no install:
npx repo-roast <repo>
```

## Usage

```bash
repo-roast owner/repo
repo-roast https://github.com/owner/repo
repo-roast https://github.com/owner/repo.git --markdown
repo-roast owner/repo --json
repo-roast owner/repo --llm        # custom AI roast (needs API key)
repo-roast owner/repo --no-llm     # force rule-based roast
```

Unauthenticated GitHub API access works but is limited to 60 requests/hour per IP. For more, set a token:

```bash
export GITHUB_TOKEN=ghp_xxx   # or pass --token
```

Exit codes: `0` success · `1` usage error · `2` repo not found / API error · `3` rate limited.

## How scoring works

Five categories, each 0–100, weighted into an overall grade (S/A/B/C/D/F):

| Category | Weight | What it checks |
| --- | --- | --- |
| README | 25% | length, title, badges, install & usage sections, code blocks, screenshots, links |
| Health | 25% | push recency, 90-day commit cadence, CI, tests, issue-to-star ratio, archived status |
| Dependencies | 15% | manifest presence, dep count/bloat, loose version pins, heavy/dated packages, lockfile |
| Governance | 15% | license, CONTRIBUTING, CHANGELOG, code of conduct, description, topics, .gitignore |
| Commits | 20% | % of the last 30 commits with meaningful messages (conventional commits score full marks; "update"/"wip" do not) |

Scores are **deterministic** — same repo, same facts, same score. The default roast engine picks its snark from per-check pools using a hash of the repo name, so a given repo always gets the same roast (shareable, reproducible).

## LLM mode

If `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` is set, repo-roast sends a compact facts digest (never raw API dumps) to the model for a custom, funnier roast. Scores always come from the deterministic rule engine — the LLM writes jokes, not numbers. If the LLM call fails, it warns and falls back to the rule-based roast.

## Shareable output

`--markdown` produces a self-contained block perfect for pasting into PRs, issues, or group chats:

```bash
repo-roast nodejs/node --markdown > roast.md
```

`--json` gives you the full structured result for CI integrations:

```json
{
  "repo": "owner/repo",
  "scores": { "readme": 40, "dependencies": 50, "health": 30, "governance": 65, "commits": 80, "overall": 50 },
  "grade": "D",
  "roasts": ["..."],
  "fixes": ["..."]
}
```

## Development

```bash
git clone https://github.com/fuleinist/repo-roast
cd repo-roast
npm test          # node --test, no dependencies to install
```

See [SPEC.md](SPEC.md) for the full design.

## License

MIT — see [LICENSE](LICENSE).
