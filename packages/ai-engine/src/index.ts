import OpenAI from "openai";
import { DealSchema } from "@deal-radar/validation-engine";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DealInput = {
  title: string;
  description: string;
  status: "PENDING" | "ACTIVE" | "CLOSED";
};

export type ScoreSuccess = {
  score: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  reasoning: string;
  recommendedAction: string;
};

export type ScoreResult =
  | { cannotScore: true }
  | ({ cannotScore: false } & ScoreSuccess);

// ---------------------------------------------------------------------------
// OpenAI prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT =
  `You are a deal-scoring engine. Analyse the deal provided and return a JSON object with exactly these fields:

- score: number between 0 and 1 (0 = worst, 1 = best)
- riskLevel: one of "LOW", "MEDIUM", "HIGH"
- reasoning: short paragraph explaining the score (max 400 chars)
- recommendedAction: concrete next step the team should take (max 400 chars)

Respond with ONLY valid JSON. No markdown, no code fences, no extra text.`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildDealPrompt(deal: DealInput): string {
  return `Title: ${deal.title}
Status: ${deal.status}
Description: ${deal.description}`;
}

function parseOpenAIResponse(raw: string): ScoreSuccess {
  // The model is instructed to return raw JSON, but strip fences if they slip
  let json = raw.trim();

  if (json.startsWith("```")) {
    json = json.replace(/```(?:json)?\s*/gi, "").replace(/```\s*$/gi, "");
  }

  const parsed = JSON.parse(json);

  // Basic runtime validation of the shape
  if (
    typeof parsed.score !== "number" ||
    !["LOW", "MEDIUM", "HIGH"].includes(parsed.riskLevel) ||
    typeof parsed.reasoning !== "string" ||
    typeof parsed.recommendedAction !== "string"
  ) {
    throw new Error("OpenAI response missing required fields");
  }

  // Clamp score to [0, 1]
  parsed.score = Math.min(1, Math.max(0, parsed.score));

  return {
    score: parsed.score,
    riskLevel: parsed.riskLevel,
    reasoning: parsed.reasoning,
    recommendedAction: parsed.recommendedAction,
  };
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate the deal, then call OpenAI to produce a score.
 *
 * Returns `{ cannotScore: true }` when input fails validation.
 * Returns the scored result when validation passes.
 */
export async function scoreDeal(deal: DealInput): Promise<ScoreResult> {
  // 1. Validate
  const validation = DealSchema.safeParse(deal);
  if (!validation.success) {
    return { cannotScore: true };
  }

  // 2. Score via OpenAI
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildDealPrompt(validation.data) },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  const result = parseOpenAIResponse(raw);

  return { cannotScore: false, ...result };
}
