#!/usr/bin/env node
// cli.js — arg parsing, orchestration, exit codes.

import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  parseRepo,
  fetchRepoData,
  UsageError,
  NotFoundError,
  RateLimitError,
  HttpError
} from './github.js';
import { analyze } from './analyze.js';
import { buildRoast } from './roast.js';
import { detectProvider, llmRoast } from './llm.js';
import { renderTerminal, renderJson, renderMarkdown } from './format.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function version() {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
    return pkg.version;
  } catch {
    return '0.0.0';
  }
}

const HELP = `repo-roast — paste any GitHub URL, get roasted (lovingly).

Usage:
  repo-roast <github-url-or-owner/repo> [options]

Options:
  --json          Output roast as JSON
  --markdown      Output roast as Markdown (for sharing)
  --llm           Force LLM roast (needs ANTHROPIC_API_KEY or OPENAI_API_KEY)
  --no-llm        Force rule-based roast even if API keys are present
  --token <t>     GitHub token (default: env GITHUB_TOKEN / GH_TOKEN)
  --help          Show this help
  --version       Show version

Examples:
  repo-roast fuleinist/repo-roast
  repo-roast https://github.com/nodejs/node --markdown
  npx repo-roast owner/repo --json

Exit codes: 0 ok · 1 usage · 2 repo/API error · 3 rate limited`;

async function main(argv, env = process.env) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        json: { type: 'boolean', default: false },
        markdown: { type: 'boolean', default: false },
        llm: { type: 'boolean', default: false },
        'no-llm': { type: 'boolean', default: false },
        token: { type: 'string' },
        help: { type: 'boolean', default: false },
        version: { type: 'boolean', default: false }
      }
    });
  } catch (e) {
    throw new UsageError(e.message);
  }

  if (parsed.values.help) {
    process.stdout.write(HELP + '\n');
    return 0;
  }
  if (parsed.values.version) {
    process.stdout.write(version() + '\n');
    return 0;
  }
  if (parsed.positionals.length !== 1) {
    process.stderr.write(HELP + '\n');
    throw new UsageError('Exactly one repo argument is required.');
  }

  const { owner, repo } = parseRepo(parsed.positionals[0]);
  const token = parsed.values.token || env.GITHUB_TOKEN || env.GH_TOKEN || undefined;

  if (!parsed.values.json && !parsed.values.markdown) {
    process.stderr.write(`🔥 Roasting ${owner}/${repo} …\n`);
  }
  const data = await fetchRepoData(owner, repo, { token });
  const analysis = analyze(data);
  let roast = buildRoast(analysis);
  let usedLLM = false;

  const provider = detectProvider(env);
  const wantLLM = parsed.values.llm || (!parsed.values['no-llm'] && Boolean(provider));
  if (wantLLM) {
    if (!provider) {
      process.stderr.write('⚠️  --llm requested but no ANTHROPIC_API_KEY / OPENAI_API_KEY found. Falling back to rule-based roast.\n');
    } else {
      const llmResult = await llmRoast(analysis, { env, provider });
      if (llmResult) {
        roast = llmResult;
        usedLLM = true;
      } else {
        process.stderr.write(`⚠️  LLM roast failed (${provider}). Falling back to rule-based roast.\n`);
      }
    }
  }

  let out;
  if (parsed.values.json) out = renderJson(analysis, roast, { llm: usedLLM });
  else if (parsed.values.markdown) out = renderMarkdown(analysis, roast, { llm: usedLLM });
  else out = renderTerminal(analysis, roast, { llm: usedLLM });
  process.stdout.write(out + '\n');
  return 0;
}

const isDirectRun = process.argv[1] && import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` ||
  (process.argv[1] || '').endsWith('cli.js');

if (isDirectRun) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err) => {
      if (err instanceof UsageError || err instanceof NotFoundError || err instanceof RateLimitError || err instanceof HttpError) {
        process.stderr.write(`Error: ${err.message}\n`);
        process.exit(err.exitCode || 1);
      }
      process.stderr.write(`Error: ${err?.message || err}\n`);
      process.exit(2);
    });
}

export { main, version, HELP };
