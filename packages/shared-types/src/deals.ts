export type DealState = {
  stage: string;
  amount: string;
  closeDate: string;
};

// ---------------------------------------------------------------------------
// Hygiene
// ---------------------------------------------------------------------------

/** Logical grouping of the hygiene issue — mirrors HygieneCategory in ai-engine */
export type HygieneCategory =
  | 'MEDDICC'
  | 'ACTIVITY'
  | 'CLOSE_DATE'
  | 'DEAL_VALUE'
  | 'STAGE'
  | 'SOURCE_CONFLICT';

export type HygieneAction = {
  /** Dot-path to the offending field, e.g. "meddicc.champion" */
  field: string;
  severity: 'BLOCKING' | 'WARNING';
  category: HygieneCategory;
  message: string;
  /** Concrete step a rep should take to fix this */
  action: string;
};

/**
 * Present on a deal response to surface data quality state.
 * Populated for both FAIL (cannotScore) and WARN (scored with caveats) states.
 */
export type DealHygieneInfo = {
  /** Whether the deal could not be scored due to data quality issues */
  cannotScore: boolean;
  /** UNCHECKED | PASS | WARN | FAIL */
  hygieneStatus: string;
  /** Field names that are missing or conflicting (BLOCKING only) */
  missingFields: string[];
  /** Full actionable guidance — includes BLOCKING and WARNING items */
  hygieneActions: HygieneAction[];
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
