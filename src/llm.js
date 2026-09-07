// llm.js — optional LLM roast. Built-in fetch only; graceful fallback.

export function detectProvider(env = process.env) {
  if (env.ANTHROPIC_API_KEY) return 'anthropic';
  if (env.OPENAI_API_KEY) return 'openai';
  return null;
}

/** Compact JSON digest of facts + rule-engine scores. LLM never sees raw API dumps. */
export function buildDigest(analysis) {
  const failing = analysis.checks
    .filter((c) => !c.ok)
    .map((c) => ({ id: c.id, detail: c.detail }));
  return {
    repo: analysis.repo,
    meta: analysis.meta,
    scores: analysis.scores,
    grade: analysis.grade,
    failingChecks: failing
  };
}

const SYSTEM_PROMPT =
  'You are a ruthless but constructive code reviewer roasting a GitHub repo. ' +
  'Use ONLY the provided facts JSON. Be funny, specific, and cite the numbers given. ' +
  'Roast the repo, never the people. Respond with ONLY valid JSON in exactly this shape: ' +
  '{"verdict": "<one-line verdict>", "roasts": ["<5 funny specific roasts>"], "fixes": ["<5 actionable concrete fixes>"]}. ' +
  'Never invent facts not present in the JSON.';

async function callAnthropic(digest, env, fetchImpl) {
  const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: env.REPO_ROAST_ANTHROPIC_MODEL || 'claude-sonnet-4-5',
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: JSON.stringify(digest) }]
    })
  });
  if (!res.ok) throw new Error(`Anthropic API HTTP ${res.status}`);
  const j = await res.json();
  const text = (j.content || []).map((b) => b.text || '').join('');
  return parseRoastJson(text);
}

async function callOpenAI(digest, env, fetchImpl) {
  const res = await fetchImpl('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: env.REPO_ROAST_OPENAI_MODEL || 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(digest) }
      ]
    })
  });
  if (!res.ok) throw new Error(`OpenAI API HTTP ${res.status}`);
  const j = await res.json();
  const text = j.choices?.[0]?.message?.content || '';
  return parseRoastJson(text);
}

export function parseRoastJson(text) {
  let s = String(text).trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const j = JSON.parse(s);
  if (!Array.isArray(j.roasts) || !Array.isArray(j.fixes)) {
    throw new Error('LLM response missing roasts/fixes arrays');
  }
  return {
    verdict: typeof j.verdict === 'string' ? j.verdict : null,
    roasts: j.roasts.filter((r) => typeof r === 'string').slice(0, 5),
    fixes: j.fixes.filter((f) => typeof f === 'string').slice(0, 5)
  };
}

/**
 * Attempt an LLM roast. Returns { verdict, roasts, fixes } or null on any
 * failure (caller falls back to the rule-based roast).
 */
export async function llmRoast(analysis, { env = process.env, provider = detectProvider(env), fetchImpl = fetch } = {}) {
  if (!provider) return null;
  const digest = buildDigest(analysis);
  try {
    const result = provider === 'anthropic' ? await callAnthropic(digest, env, fetchImpl) : await callOpenAI(digest, env, fetchImpl);
    if (result.roasts.length === 0) return null;
    return result;
  } catch {
    return null;
  }
}
