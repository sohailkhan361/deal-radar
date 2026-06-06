/**
 * Shared types for the AI scoring engine.
 * Separate from index.ts so hygiene.ts can import them without
 * pulling in the OpenAI client.
 */

// ---------------------------------------------------------------------------
// MEDDICC qualification fields
// ---------------------------------------------------------------------------

export type MeddiccFields = {
  /** Quantified business value the customer will gain */
  metrics?: string;
  /** Person who controls the budget and signs the contract */
  economicBuyer?: string;
  /** Formal criteria used to evaluate and select a vendor */
  decisionCriteria?: string;
  /** Steps in the customer's buying / approval process */
  decisionProcess?: string;
  /** Core business pain driving the purchase */
  identifyPain?: string;
  /** Internal advocate who will champion your solution */
  champion?: string;
  /** (optional) Competitive situation */
  competition?: string;
};

// ---------------------------------------------------------------------------
// Activity snapshot (lightweight, sourced from DB)
// ---------------------------------------------------------------------------

export type ActivitySnapshot = {
  eventType: string;
  occurredAt: string; // ISO string
  summary?: string;
};

// ---------------------------------------------------------------------------
// Multi-source conflict detection
// ---------------------------------------------------------------------------

export type SourceSnapshot = {
  /** Source name, e.g. "Salesforce", "HubSpot", "manual" */
  source: string;
  stage?: string;
  amount?: string;
};

// ---------------------------------------------------------------------------
// Full deal input for scoring
// ---------------------------------------------------------------------------

export type DealScoringInput = {
  dealId: string;
  title?: string;
  stage: string;
  amount: string;
  closeDate: string;
  activities?: ActivitySnapshot[];
  meddicc?: MeddiccFields;
  /** Values from multiple integrated CRM sources — used for conflict detection */
  sourceOfTruth?: SourceSnapshot[];
};

// ---------------------------------------------------------------------------
// Score result (discriminated union)
// ---------------------------------------------------------------------------

export type ScoreSuccess = {
  score: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  reasoning: string;
  recommendedAction: string;
  /** Non-blocking hygiene warnings surfaced alongside a successful score */
  warnings: import('./hygiene').HygieneAction[];
};

/**
 * Returned when hygiene checks block scoring.
 * hygieneActions carries full actionable guidance per field.
 */
export type HygieneFailure = {
  cannotScore: true;
  missingFields: string[];
  hygieneActions: import('./hygiene').HygieneAction[];
};

export type ScoreResult =
  | HygieneFailure
  | ({ cannotScore: false } & ScoreSuccess);
