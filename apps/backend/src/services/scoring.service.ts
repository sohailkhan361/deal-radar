/**
 * ScoringService
 *
 * Bridges the worker pipeline and the @deal-radar/ai-engine.
 * Builds a DealScoringInput from persisted Deal + Activity rows,
 * calls scoreDeal(), then persists the result back to the Deal record.
 */

import type { Activity, Deal, PrismaClient } from '@prisma/client';
import { scoreDeal } from '@deal-radar/ai-engine';
import type { DealScoringInput, ActivitySnapshot, MeddiccFields } from '@deal-radar/ai-engine';

type TransactionClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function buildMeddicc(deal: Deal): MeddiccFields | undefined {
  const m: MeddiccFields = {
    metrics: deal.meddiccMetrics ?? undefined,
    economicBuyer: deal.meddiccEconomicBuyer ?? undefined,
    decisionCriteria: deal.meddiccDecisionCriteria ?? undefined,
    decisionProcess: deal.meddiccDecisionProcess ?? undefined,
    identifyPain: deal.meddiccIdentifyPain ?? undefined,
    champion: deal.meddiccChampion ?? undefined,
    competition: deal.meddiccCompetition ?? undefined,
  };

  // Only attach if at least one field is populated
  const hasAny = Object.values(m).some(v => v !== undefined);
  return hasAny ? m : undefined;
}

function buildActivitySnapshots(activities: Activity[]): ActivitySnapshot[] {
  return activities.map(a => ({
    eventType: a.eventType,
    occurredAt: a.occurredAt.toISOString(),
    // Surface a human-readable summary from the payload when possible
    summary: extractSummary(a.payload as Record<string, unknown>),
  }));
}

function extractSummary(payload: Record<string, unknown>): string | undefined {
  const candidates = ['note', 'subject', 'summary', 'description', 'message', 'title'];
  for (const key of candidates) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim().slice(0, 200);
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Main scoring function
// ---------------------------------------------------------------------------

/**
 * Score (or hygiene-gate) a deal given its current state and activities.
 *
 * Called from the worker after applyEvent().
 * Persists the result to the Deal row via the provided transaction client.
 */
export async function scoreAndPersist(
  tx: TransactionClient,
  deal: Deal,
  activities: Activity[],
): Promise<void> {
  const input: DealScoringInput = {
    dealId: deal.dealId,
    stage: deal.stage,
    amount: deal.amount.toString(),
    closeDate: deal.closeDate.toISOString(),
    activities: buildActivitySnapshots(activities),
    meddicc: buildMeddicc(deal),
  };

  let updateData: Parameters<typeof tx.deal.update>[0]['data'];

  try {
    const result = await scoreDeal(input);

    if (result.cannotScore) {
      // Hygiene gate: persist the failure for the dashboard to surface
      updateData = {
        validationStatus: 'HYGIENE_FAIL',
        hygieneStatus: 'FAIL',
        missingFields: result.missingFields,
        lastHygieneAt: new Date(),
        // Clear any stale score from a previous pass
        healthScore: null,
        riskLevel: null,
        aiReasoning: null,
        recommendedAction: null,
      };

      console.warn('[scoring] Deal cannot be scored — hygiene issues found', {
        dealId: deal.dealId,
        missingFields: result.missingFields,
        hygieneActions: result.hygieneActions.map(a => `[${a.severity}] ${a.field}: ${a.message}`),
      });
    } else {
      // Successful score
      updateData = {
        validationStatus: 'SCORED',
        hygieneStatus: 'PASS',
        missingFields: [],
        lastHygieneAt: new Date(),
        healthScore: result.score,
        riskLevel: result.riskLevel,
        aiReasoning: result.reasoning,
        recommendedAction: result.recommendedAction,
      };

      console.log('[scoring] Deal scored successfully', {
        dealId: deal.dealId,
        score: result.score,
        riskLevel: result.riskLevel,
      });
    }
  } catch (error) {
    // Scoring errors are non-fatal — log but don't fail the transaction
    console.error('[scoring] Scoring error — deal will remain in previous state', {
      dealId: deal.dealId,
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  await tx.deal.update({
    where: { dealId: deal.dealId },
    data: updateData,
  });
}
