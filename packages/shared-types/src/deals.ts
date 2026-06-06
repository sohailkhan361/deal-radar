export type DealState = {
  stage: string;
  amount: string;
  closeDate: string;
};

// ---------------------------------------------------------------------------
// Hygiene
// ---------------------------------------------------------------------------

export type HygieneAction = {
  field: string;
  severity: 'BLOCKING' | 'WARNING';
  message: string;
  action: string;
};

/**
 * Present on a deal response when validationStatus === 'HYGIENE_FAIL'.
 * Surfaces actionable guidance directly on the deal object.
 */
export type DealHygieneInfo = {
  /** Whether the deal could not be scored due to data quality issues */
  cannotScore: boolean;
  /** hygieneStatus: UNCHECKED | PASS | FAIL */
  hygieneStatus: string;
  /** Field names that are missing or conflicting */
  missingFields: string[];
  /** ISO timestamp of last hygiene check */
  lastHygieneAt: string | null;
};

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export type DealHealthFields = {
  healthScore: number | null;
  riskLevel: string | null;
  validationStatus: string;
  aiReasoning: string | null;
  recommendedAction: string | null;
  hygiene: DealHygieneInfo;
};

// ---------------------------------------------------------------------------
// MEDDICC
// ---------------------------------------------------------------------------

export type MeddiccFields = {
  metrics: string | null;
  economicBuyer: string | null;
  decisionCriteria: string | null;
  decisionProcess: string | null;
  identifyPain: string | null;
  champion: string | null;
  competition: string | null;
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
  meddicc: MeddiccFields;
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
