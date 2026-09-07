# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows semver.

## [Unreleased]

## [0.1.0] - 2026-09-07

### Added

- Initial release: `repo-roast` CLI — roast any GitHub repo from its URL or `owner/repo`.
- Deterministic scoring engine (0–100 + S/A/B/C/D/F grade) across five categories: README, dependencies, health, governance, commit messages.
- Rule-based roast engine with per-check snark pools; stable output per repo (hash-selected).
- Optional LLM mode (Anthropic or OpenAI) with automatic fallback to rule-based on failure; scores always deterministic.
- Output formats: ANSI terminal, `--json`, `--markdown` (shareable).
- GitHub API layer with rate-limit detection and clear exit codes (0/1/2/3).
- Test suite: 29 tests via `node --test`, no dependencies.
- CI: GitHub Actions across Node 20/22/24.

[Unreleased]: https://github.com/fuleinist/repo-roast/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/fuleinist/repo-roast/releases/tag/v0.1.0
