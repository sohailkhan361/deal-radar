import type { Activity, Deal } from '@prisma/client';
import type {
  ActivityResponse,
  DealDetailResponse,
  DealHealthFields,
  DealHygieneInfo,
  DealResponse,
  DealState,
  HygieneAction,
  MeddiccFields,
} from '@deal-radar/shared-types';

export type { ActivityResponse, DealDetailResponse, DealHealthFields, DealResponse, DealState };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Safely cast the persisted Json? column to HygieneAction[].
 * Prisma returns JSON columns as `unknown` at runtime — we validate shape
 * enough to be safe without a full parse library.
 */
function parseHygieneActions(raw: unknown): HygieneAction[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is HygieneAction =>
      item !== null &&
      typeof item === 'object' &&
      typeof (item as Record<string, unknown>).field === 'string' &&
      typeof (item as Record<string, unknown>).severity === 'string' &&
      typeof (item as Record<string, unknown>).message === 'string' &&
      typeof (item as Record<string, unknown>).action === 'string',
  );
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

export const mapDealState = (deal: Deal): DealState => ({
  stage: deal.stage,
  amount: deal.amount.toString(),
  closeDate: deal.closeDate.toISOString(),
});

export const mapDealHygiene = (deal: Deal): DealHygieneInfo => ({
  cannotScore: deal.hygieneStatus === 'FAIL',
  hygieneStatus: deal.hygieneStatus,
  missingFields: deal.missingFields,
  hygieneActions: parseHygieneActions(deal.hygieneActions),
  lastHygieneAt: deal.lastHygieneAt?.toISOString() ?? null,
});

export const mapDealHealth = (deal: Deal): DealHealthFields => ({
  healthScore: deal.healthScore,
  riskLevel: deal.riskLevel,
  validationStatus: deal.validationStatus,
  aiReasoning: deal.aiReasoning,
  recommendedAction: deal.recommendedAction,
  hygiene: mapDealHygiene(deal),
});

export const mapMeddicc = (deal: Deal): MeddiccFields => ({
  metrics: deal.meddiccMetrics,
  economicBuyer: deal.meddiccEconomicBuyer,
  decisionCriteria: deal.meddiccDecisionCriteria,
  decisionProcess: deal.meddiccDecisionProcess,
  identifyPain: deal.meddiccIdentifyPain,
  champion: deal.meddiccChampion,
  competition: deal.meddiccCompetition,
});

export const mapActivity = (activity: Activity): ActivityResponse => ({
  id: activity.id,
  eventId: activity.eventId,
  eventType: activity.eventType,
  payload: activity.payload,
  occurredAt: activity.occurredAt.toISOString(),
  createdAt: activity.createdAt.toISOString(),
});

export const mapDeal = (deal: Deal): DealResponse => ({
  id: deal.id,
  dealId: deal.dealId,
  state: mapDealState(deal),
  health: mapDealHealth(deal),
  createdAt: deal.createdAt.toISOString(),
  updatedAt: deal.updatedAt.toISOString(),
});

export const mapDealDetail = (deal: Deal, activities: Activity[]): DealDetailResponse => ({
  ...mapDeal(deal),
  activities: activities.map(mapActivity),
  meddicc: mapMeddicc(deal),
});
