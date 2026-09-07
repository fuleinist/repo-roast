# Contributing to repo-roast

Thanks for your interest! This project has zero runtime dependencies and no build step — contributing is as easy as cloning.

## Setup

```bash
git clone https://github.com/fuleinist/repo-roast
cd repo-roast
npm test        # runs node --test; nothing to install
```

Requires Node >= 20 (built-in `fetch` and `node:test`).

## Making changes

1. Create a branch: `git checkout -b feat/my-thing`
2. Keep the rules: zero runtime dependencies, ESM only, works on Windows and POSIX.
3. Add tests for new behavior in `test/` (fixture-based — never hit the live GitHub API in tests).
4. Use Conventional Commits (`feat:`, `fix:`, `docs:`, `ci:`, `test:`).
5. Run `npm test` and make sure everything passes before opening a PR.

## Adding roast lines

Roast pools live in `src/roast.js`. Every failing check id needs:

- an entry in `POOLS` (2–4 snarky one-liners; roast the repo, never the author)
- an entry in `FIXES` (one concrete, actionable fix)

There is a test that enforces both exist for every check id.

## Reporting issues

- Bugs: include the repo you roasted, the command, and the output.
- Feature ideas: open an issue first — this project stays intentionally small.

## Code of Conduct

Be kind. Roasting repos is the product; roasting people is not.
