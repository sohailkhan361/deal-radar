import type { Activity, Deal } from '@prisma/client';

export type DealHealthFields = {
  healthScore: number | null;
  riskLevel: string | null;
  validationStatus: string;
  aiReasoning: string | null;
};

export type DealState = {
  stage: string;
  amount: string;
  closeDate: string;
};

export type ActivityResponse = {
  id: string;
  eventId: string;
  eventType: string;
  payload: unknown;
  occurredAt: string;
  createdAt: string;
};

export type DealResponse = {
  id: string;
  dealId: string;
  state: DealState;
  health: DealHealthFields;
  createdAt: string;
  updatedAt: string;
};

export type DealDetailResponse = DealResponse & {
  activities: ActivityResponse[];
};

export const mapDealState = (deal: Deal): DealState => ({
  stage: deal.stage,
  amount: deal.amount.toString(),
  closeDate: deal.closeDate.toISOString(),
});

export const mapDealHealth = (deal: Deal): DealHealthFields => ({
  healthScore: deal.healthScore,
  riskLevel: deal.riskLevel,
  validationStatus: deal.validationStatus,
  aiReasoning: deal.aiReasoning,
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
});
