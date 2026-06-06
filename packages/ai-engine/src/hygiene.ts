/**
 * Sales Hygiene Enforcement
 *
 * Checks whether a deal has sufficient data quality to be scored.
 * Returns structured, actionable guidance when data is missing or conflicting.
 *
 * Design rules:
 * - BLOCKING issues gate scoring entirely.
 * - WARNING issues are surfaced alongside successful scores.
 * - Each action carries a `category` so the UI can group/filter by area.
 * - Stage-aware MEDDICC: later stages require more fields.
 * - Activity staleness thresholds scale with deal stage.
 */

import type { DealScoringInput } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HygieneSeverity = 'BLOCKING' | 'WARNING';

/**
 * Logical grouping of the hygiene issue — used by the UI to organise
 * actions into sections (e.g. "MEDDICC", "Activity", "Data Quality").
 */
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
  severity: HygieneSeverity;
  category: HygieneCategory;
  message: string;
  /** Concrete, first-person step the rep should take to fix this */
  action: string;
};

export type HygieneResult =
  | { cannotScore: false; warnings: HygieneAction[] }
  | {
      cannotScore: true;
      missingFields: string[];
      hygieneActions: HygieneAction[];
    };

// ---------------------------------------------------------------------------
// Stage buckets
// ---------------------------------------------------------------------------

/** Stages considered "late" — full MEDDICC required */
const LATE_STAGES = new Set(['PROPOSAL', 'NEGOTIATION', 'CLOSING', 'CLOSED']);

/**
 * Activity staleness limits (in days) by deal stage.
 * Later stages tolerate much less silence.
 */
const STALENESS_LIMITS: Record<string, number> = {
  DISCOVERY: 45,
  QUALIFICATION: 30,
  PROPOSAL: 14,
  NEGOTIATION: 7,
  CLOSING: 5,
  DEFAULT: 30,
};

// ---------------------------------------------------------------------------
// MEDDICC field config
// Each field carries stage-requirements and a default action.
// ---------------------------------------------------------------------------

type MeddiccFieldConfig = {
  key: keyof NonNullable<DealScoringInput['meddicc']>;
  label: string;
  requiredFrom: 'ALWAYS' | 'LATE_STAGE';
  action: string;
};

const MEDDICC_FIELDS: MeddiccFieldConfig[] = [
  {
    key: 'identifyPain',
    label: 'meddicc.identifyPain',
    requiredFrom: 'ALWAYS',
    action:
      "Record the core business pain driving this deal in the customer's own words — this is the foundation of your value proposition.",
  },
  {
    key: 'metrics',
    label: 'meddicc.metrics',
    requiredFrom: 'ALWAYS',
    action:
      'Quantify the business impact with the champion: expected revenue gain, cost reduction, or time saved. Use specific numbers.',
  },
  {
    key: 'champion',
    label: 'meddicc.champion',
    requiredFrom: 'ALWAYS',
    action:
      'Identify an internal champion who has organisational influence, feels the pain urgently, and will actively advocate for your solution.',
  },
  {
    key: 'economicBuyer',
    label: 'meddicc.economicBuyer',
    requiredFrom: 'LATE_STAGE',
    action:
      'Identify and document the Economic Buyer — the person who controls the budget and signs the contract. Schedule a direct meeting if you have not yet met them.',
  },
  {
    key: 'decisionCriteria',
    label: 'meddicc.decisionCriteria',
    requiredFrom: 'LATE_STAGE',
    action:
      'Capture the formal criteria the customer uses to evaluate vendors: security requirements, pricing model, integration needs, SLA expectations.',
  },
  {
    key: 'decisionProcess',
    label: 'meddicc.decisionProcess',
    requiredFrom: 'LATE_STAGE',
    action:
      'Map the buying process: who approves, which stakeholders vote, legal/procurement steps, and the expected timeline to signature.',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normaliseStage(stage: string): string {
  return stage.trim().toUpperCase();
}

function isLateStage(stage: string): boolean {
  return LATE_STAGES.has(normaliseStage(stage));
}

function stalenessLimit(stage: string): number {
  return STALENESS_LIMITS[normaliseStage(stage)] ?? STALENESS_LIMITS.DEFAULT;
}

function isFieldEmpty(value: string | undefined | null): boolean {
  return !value || value.trim().length === 0;
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

function checkStage(deal: DealScoringInput): HygieneAction | null {
  if (!deal.stage || deal.stage.trim() === '' || normaliseStage(deal.stage) === 'UNKNOWN') {
    return {
      field: 'stage',
      severity: 'BLOCKING',
      category: 'STAGE',
      message: 'Deal stage is missing or unknown.',
      action:
        'Set the current deal stage in your CRM to accurately reflect where this opportunity stands in the sales cycle.',
    };
  }
  return null;
}

function checkAmount(deal: DealScoringInput): HygieneAction | null {
  const amount = parseFloat(deal.amount);
  if (isNaN(amount) || amount <= 0) {
    return {
      field: 'amount',
      severity: 'BLOCKING',
      category: 'DEAL_VALUE',
      message: 'Deal amount is zero or missing.',
      action:
        'Enter the expected deal value in your CRM. Even a rough estimate enables risk-level calculation — you can refine it as the deal progresses.',
    };
  }
  return null;
}

function checkCloseDate(deal: DealScoringInput): HygieneAction | null {
  if (!deal.closeDate) {
    return {
      field: 'closeDate',
      severity: 'BLOCKING',
      category: 'CLOSE_DATE',
      message: 'Close date is not set.',
      action:
        "Set a realistic close date that aligns with the agreed procurement timeline and the customer's buying process.",
    };
  }

  const closeDate = new Date(deal.closeDate);
  if (isNaN(closeDate.getTime())) {
    return {
      field: 'closeDate',
      severity: 'BLOCKING',
      category: 'CLOSE_DATE',
      message: `Close date "${deal.closeDate}" is not a valid date.`,
      action: 'Correct the close date format in your CRM (expected: ISO 8601, e.g. 2025-09-30).',
    };
  }

  const now = new Date();
  if (normaliseStage(deal.stage) !== 'CLOSED' && closeDate < now) {
    return {
      field: 'closeDate',
      severity: 'BLOCKING',
      category: 'CLOSE_DATE',
      message: `Close date (${deal.closeDate.slice(0, 10)}) is in the past but the deal is not marked CLOSED.`,
      action:
        'Update the close date to reflect the current expected close, or update the stage to CLOSED/LOST to reflect reality.',
    };
  }

  // Warn if close date is unrealistically far out (> 18 months)
  const monthsOut = (closeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30);
  if (monthsOut > 18) {
    return {
      field: 'closeDate',
      severity: 'WARNING',
      category: 'CLOSE_DATE',
      message: `Close date is ${Math.round(monthsOut)} months away — this may not reflect current intent.`,
      action:
        'Confirm the close date with the customer and update it to reflect a committed procurement timeline.',
    };
  }

  return null;
}

function checkActivityHistory(deal: DealScoringInput): HygieneAction | null {
  if (!deal.activities || deal.activities.length === 0) {
    return {
      field: 'activities',
      severity: 'BLOCKING',
      category: 'ACTIVITY',
      message: 'No activity history found for this deal.',
      action:
        'Log at least one interaction (email, meeting, call, or note) to establish an engagement history before the deal can be scored.',
    };
  }

  const now = Date.now();
  const latestMs = deal.activities
    .map(a => new Date(a.occurredAt).getTime())
    .filter(t => !isNaN(t))
    .sort((a, b) => b - a)[0];

  if (latestMs === undefined) {
    return {
      field: 'activities.occurredAt',
      severity: 'BLOCKING',
      category: 'ACTIVITY',
      message: 'Activity timestamps are invalid or unreadable.',
      action:
        'Ensure activity records in your CRM include valid timestamps. Check for data import issues.',
    };
  }

  const daysSince = (now - latestMs) / (1000 * 60 * 60 * 24);
  const limit = stalenessLimit(deal.stage);

  if (daysSince > limit) {
    const severity: HygieneSeverity = isLateStage(deal.stage) ? 'BLOCKING' : 'WARNING';
    return {
      field: 'activities.recency',
      severity,
      category: 'ACTIVITY',
      message: `Last activity was ${Math.round(daysSince)} days ago (limit for ${deal.stage} stage: ${limit} days).`,
      action:
        'Re-engage the prospect and log a fresh touchpoint — call, email, or meeting — to confirm the deal is still active and moving forward.',
    };
  }

  // Warn if activity volume is very low for a late-stage deal
  if (isLateStage(deal.stage) && deal.activities.length < 3) {
    return {
      field: 'activities.volume',
      severity: 'WARNING',
      category: 'ACTIVITY',
      message: `Only ${deal.activities.length} activity logged for a ${deal.stage}-stage deal.`,
      action:
        'Late-stage deals should show sustained engagement. Ensure all interactions are logged to give the scoring engine an accurate picture.',
    };
  }

  return null;
}

function checkMeddiccFields(deal: DealScoringInput): HygieneAction[] {
  const stage = normaliseStage(deal.stage);
  const actions: HygieneAction[] = [];

  for (const field of MEDDICC_FIELDS) {
    const isRequired =
      field.requiredFrom === 'ALWAYS' || isLateStage(stage);

    if (!isRequired) continue;

    const value = deal.meddicc?.[field.key];
    if (isFieldEmpty(value)) {
      // Missing champion or economic buyer is always BLOCKING regardless of stage
      const isCritical = field.key === 'champion' || field.key === 'economicBuyer';
      actions.push({
        field: field.label,
        severity: isCritical || isLateStage(stage) ? 'BLOCKING' : 'WARNING',
        category: 'MEDDICC',
        message: `MEDDICC field "${field.label}" is missing or empty.`,
        action: field.action,
      });
    }
  }

  // Warn on missing competition field in late-stage deals
  if (isLateStage(stage) && isFieldEmpty(deal.meddicc?.competition)) {
    actions.push({
      field: 'meddicc.competition',
      severity: 'WARNING',
      category: 'MEDDICC',
      message: 'Competitive landscape is not documented.',
      action:
        'Document the competitive situation: who else is being evaluated, your differentiation, and any risks of losing to the competition.',
    });
  }

  return actions;
}

function checkSourceConflict(deal: DealScoringInput): HygieneAction[] {
  if (!deal.sourceOfTruth || deal.sourceOfTruth.length < 2) {
    return [];
  }

  const actions: HygieneAction[] = [];

  // Stage conflict
  const stages = deal.sourceOfTruth.map(s => s.stage).filter(Boolean) as string[];
  const uniqueStages = new Set(stages.map(s => normaliseStage(s)));

  if (uniqueStages.size > 1) {
    actions.push({
      field: 'sourceOfTruth.stage',
      severity: 'BLOCKING',
      category: 'SOURCE_CONFLICT',
      message: `Conflicting stage values across data sources: ${[...uniqueStages].join(' vs ')}.`,
      action:
        'Reconcile the deal stage between your CRM and all integrated tools. Establish which system is the single source of truth and update the others to match.',
    });
  }

  // Amount conflict (> 20% variance)
  const amounts = deal.sourceOfTruth
    .map(s => parseFloat(s.amount ?? ''))
    .filter(n => !isNaN(n) && n > 0);

  if (amounts.length > 1) {
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    const variance = (max - min) / max;

    if (variance > 0.2) {
      const sourceNames = deal.sourceOfTruth
        .filter(s => s.amount)
        .map(s => `${s.source}: ${s.amount}`)
        .join(', ');
      actions.push({
        field: 'sourceOfTruth.amount',
        severity: 'BLOCKING',
        category: 'SOURCE_CONFLICT',
        message: `Deal amount conflicts across sources (${Math.round(variance * 100)}% variance): ${sourceNames}.`,
        action:
          'Align the deal value across all integrated systems. A variance over 20% blocks accurate risk scoring — update the outlier source.',
      });
    }
  }

  // Stage-amount mismatch: late-stage deal with amount still at zero in one source
  const zeroAmounts = deal.sourceOfTruth.filter(s => {
    const v = parseFloat(s.amount ?? '');
    return isNaN(v) || v === 0;
  });

  if (isLateStage(deal.stage) && zeroAmounts.length > 0) {
    const names = zeroAmounts.map(s => s.source).join(', ');
    actions.push({
      field: 'sourceOfTruth.amount',
      severity: 'WARNING',
      category: 'SOURCE_CONFLICT',
      message: `Late-stage deal has missing amount in source(s): ${names}.`,
      action:
        `Update the deal value in ${names} to match the agreed contract value before moving to close.`,
    });
  }

  return actions;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run all hygiene checks against the deal.
 *
 * Returns `{ cannotScore: false, warnings }` when the deal is clean enough to score.
 * Returns `{ cannotScore: true, missingFields, hygieneActions }` when BLOCKING
 * issues are found. hygieneActions includes both BLOCKING and WARNING entries
 * so the UI can render the full picture.
 */
export function checkHygiene(deal: DealScoringInput): HygieneResult {
  const allActions: HygieneAction[] = [];

  // Run each check and collect results
  const singleChecks: Array<HygieneAction | null> = [
    checkStage(deal),
    checkAmount(deal),
    checkCloseDate(deal),
    checkActivityHistory(deal),
  ];

  for (const result of singleChecks) {
    if (result) allActions.push(result);
  }

  // Multi-result checks
  allActions.push(...checkMeddiccFields(deal));
  allActions.push(...checkSourceConflict(deal));

  const blockingActions = allActions.filter(a => a.severity === 'BLOCKING');

  if (blockingActions.length > 0) {
    return {
      cannotScore: true,
      // Deduplicated list of field names for quick lookup
      missingFields: [...new Set(blockingActions.map(a => a.field))],
      // Full list (blocking + warnings) so UI can render complete guidance
      hygieneActions: allActions,
    };
  }

  return {
    cannotScore: false,
    warnings: allActions.filter(a => a.severity === 'WARNING'),
  };
}
