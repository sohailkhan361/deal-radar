/**
 * @deal-radar/ai-engine
 *
 * Entry point — exports the public API and all types.
 */

import OpenAI from 'openai';
import { checkHygiene } from './hygiene';
import type { DealScoringInput, ScoreResult, ScoreSuccess } from './types';

export type { DealScoringInput, ScoreResult, ScoreSuccess, HygieneFailure } from './types';
export type { HygieneAction, HygieneResult, HygieneSeverity } from './hygiene';
export { checkHygiene } from './hygiene';

// ---------------------------------------------------------------------------
// OpenAI client (lazy – only instantiated on first call)
// ---------------------------------------------------------------------------

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a B2B sales deal-scoring engine trained on MEDDICC methodology.

Analyse the deal provided and return a JSON object with exactly these fields:

- score: number between 0 and 1 (0 = worst deal health, 1 = best)
- riskLevel: one of "LOW", "MEDIUM", "HIGH"
- reasoning: paragraph explaining the score using MEDDICC dimensions (max 500 chars)
- recommendedAction: the single most important concrete next step the sales rep should take (max 400 chars)

Scoring guidance:
- MEDDICC completeness is the primary signal. Missing Champion or Economic Buyer is HIGH risk.
- Activity recency matters: no touchpoint in >14 days in late stage = elevated risk.
- Mismatched close date vs stage progression = elevated risk.
- Deal amount alone does not drive risk — qualification quality does.

Respond with ONLY valid JSON. No markdown, no code fences, no extra text.`;

function buildPrompt(deal: DealScoringInput): string {
  const lines: string[] = [
    `Deal ID: ${deal.dealId}`,
    deal.title ? `Title: ${deal.title}` : null,
    `Stage: ${deal.stage}`,
    `Amount: ${deal.amount}`,
    `Expected Close: ${deal.closeDate}`,
  ].filter(Boolean) as string[];

  if (deal.meddicc) {
    lines.push('');
    lines.push('--- MEDDICC ---');
    const m = deal.meddicc;
    if (m.metrics) lines.push(`Metrics: ${m.metrics}`);
    if (m.economicBuyer) lines.push(`Economic Buyer: ${m.economicBuyer}`);
    if (m.decisionCriteria) lines.push(`Decision Criteria: ${m.decisionCriteria}`);
    if (m.decisionProcess) lines.push(`Decision Process: ${m.decisionProcess}`);
    if (m.identifyPain) lines.push(`Identify Pain: ${m.identifyPain}`);
    if (m.champion) lines.push(`Champion: ${m.champion}`);
    if (m.competition) lines.push(`Competition: ${m.competition}`);
  }

  if (deal.activities && deal.activities.length > 0) {
    lines.push('');
    lines.push('--- Recent Activity (latest 10) ---');
    const recent = [...deal.activities]
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, 10);
    for (const act of recent) {
      const date = new Date(act.occurredAt).toISOString().split('T')[0];
      const summary = act.summary ? ` — ${act.summary}` : '';
      lines.push(`${date} [${act.eventType}]${summary}`);
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

function parseResponse(raw: string): ScoreSuccess {
  let json = raw.trim();

  if (json.startsWith('```')) {
    json = json.replace(/```(?:json)?\s*/gi, '').replace(/```\s*$/gi, '');
  }

  const parsed = JSON.parse(json);

  if (
    typeof parsed.score !== 'number' ||
    !['LOW', 'MEDIUM', 'HIGH'].includes(parsed.riskLevel) ||
    typeof parsed.reasoning !== 'string' ||
    typeof parsed.recommendedAction !== 'string'
  ) {
    throw new Error('OpenAI response missing required fields');
  }

  return {
    score: Math.min(1, Math.max(0, parsed.score)),
    riskLevel: parsed.riskLevel,
    reasoning: parsed.reasoning,
    recommendedAction: parsed.recommendedAction,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Score a deal using MEDDICC methodology.
 *
 * 1. Runs hygiene checks first.
 *    - If the deal has blocking issues, returns `{ cannotScore: true, missingFields, hygieneActions }`.
 * 2. If clean, calls OpenAI and returns the full scored result.
 */
export async function scoreDeal(deal: DealScoringInput): Promise<ScoreResult> {
  // --- Hygiene gate ---
  const hygiene = checkHygiene(deal);
  if (hygiene.cannotScore) {
    return hygiene;
  }

  // --- Score via OpenAI ---
  const completion = await getOpenAI().chat.completions.create({
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    temperature: 0.2,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildPrompt(deal) },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? '';
  const result = parseResponse(raw);

  return { cannotScore: false, ...result };
}
