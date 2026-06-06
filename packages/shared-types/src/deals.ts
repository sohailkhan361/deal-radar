export type DealState = {
  stage: string;
  amount: string;
  closeDate: string;
};

export type DealHealthFields = {
  healthScore: number | null;
  riskLevel: string | null;
  validationStatus: string;
  aiReasoning: string | null;
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

export type DealListItemResponse = DealResponse & {
  activities: ActivityResponse[];
  activityCount: number;
};

export type DealDetailResponse = DealResponse & {
  activities: ActivityResponse[];
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
};

export type PaginatedDealsResponse = {
  data: DealListItemResponse[];
  pagination: PaginationMeta;
};

export type PaginatedDealDetailResponse = {
  data: DealDetailResponse;
  pagination: PaginationMeta;
};
