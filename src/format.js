// format.js — terminal / JSON / Markdown renderers.

const CATEGORIES = [
  ['readme', 'README'],
  ['dependencies', 'Dependencies'],
  ['health', 'Health'],
  ['governance', 'Governance'],
  ['commits', 'Commits']
];

function color(score, text) {
  const code = score >= 80 ? '32' : score >= 60 ? '33' : '31';
  return `\u001b[${code}m${text}\u001b[0m`;
}

function bar(score) {
  const filled = Math.round(score / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

export function renderJson(analysis, roast, { llm = false } = {}) {
  return JSON.stringify(
    {
      repo: analysis.repo,
      fetchedAt: analysis.fetchedAt,
      meta: analysis.meta,
      scores: analysis.scores,
      grade: analysis.grade,
      verdict: roast.verdict || null,
      roasts: roast.roasts,
      fixes: roast.fixes,
      llm
    },
    null,
    2
  );
}

export function renderMarkdown(analysis, roast, { llm = false } = {}) {
  const lines = [];
  lines.push(`# 🔥 repo-roast: ${analysis.repo}`);
  lines.push('');
  lines.push(`**Grade: ${analysis.grade} — ${analysis.scores.overall}/100**${roast.verdict ? ` _${roast.verdict}_` : ''}`);
  lines.push('');
  lines.push('| Category | Score |');
  lines.push('| --- | --- |');
  for (const [key, label] of CATEGORIES) {
    lines.push(`| ${label} | ${analysis.scores[key]}/100 |`);
  }
  lines.push('');
  lines.push('## The Roast 🍖');
  for (const r of roast.roasts) lines.push(`- ${r}`);
  lines.push('');
  lines.push('## The Fixes 🔧');
  roast.fixes.forEach((f, i) => lines.push(`${i + 1}. ${f}`));
  lines.push('');
  lines.push(`_Roasted by [repo-roast](https://github.com/fuleinist/repo-roast)${llm ? ' (LLM mode)' : ''} — scores are deterministic, the snark is free._`);
  return lines.join('\n');
}

export function renderTerminal(analysis, roast, { llm = false } = {}) {
  const out = [];
  out.push('');
  out.push(`  🔥 R E P O - R O A S T 🔥   ${analysis.repo}`);
  if (roast.verdict) out.push(`  ${roast.verdict}`);
  out.push('  ' + '─'.repeat(46));
  out.push('');
  for (const [key, label] of CATEGORIES) {
    const s = analysis.scores[key];
    out.push(`  ${label.padEnd(14)} ${color(s, bar(s))} ${String(s).padStart(3)}/100`);
  }
  out.push('  ' + '─'.repeat(46));
  out.push(`  OVERALL        ${color(analysis.scores.overall, bar(analysis.scores.overall))} ${String(analysis.scores.overall).padStart(3)}/100   GRADE: ${color(analysis.scores.overall, analysis.grade)}`);
  out.push('');
  out.push('  🍖 THE ROAST');
  for (const r of roast.roasts) out.push(`   • ${r}`);
  out.push('');
  out.push('  🔧 THE FIXES');
  roast.fixes.forEach((f, i) => out.push(`   ${i + 1}. ${f}`));
  out.push('');
  out.push(`  ${llm ? 'LLM roast' : 'Rule-based roast'} · scores are deterministic · github.com/fuleinist/repo-roast`);
  out.push('');
  return out.join('\n');
}
