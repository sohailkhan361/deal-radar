/**
 * Sales Hygiene Enforcement
 *
 * Checks whether a deal has sufficient data to be scored.
 * Returns actionable guidance when data is missing or conflicting.
 */

import type { DealScoringInput } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HygieneSeverity = 'BLOCKING' | 'WARNING';

export type HygieneAction = {
  field: string;
  severity: HygieneSeverity;
  message: string;
  /** Concrete step a rep should take to fix this */
  action: string;
};

export type HygieneResult =
  | { cannotScore: false }
  | {
      cannotScore: true;
      missingFields: string[];
      hygieneActions: HygieneAction[];
    };

// ---------------------------------------------------------------------------
// MEDDICC minimum coverage — all fields are blocking when missing
// ---------------------------------------------------------------------------

const MEDDICC_FIELDS: Array<{
  key: keyof NonNullable<DealScoringInput['meddicc']>;
  label: string;
  action: string;
}> = [
  {
    key: 'metrics',
    label: 'meddicc.metrics',
    action:
      'Ask the champion to quantify the business impact: revenue gain, cost reduction, or time saved.',
  },
  {
    key: 'economicBuyer',
    label: 'meddicc.economicBuyer',
    action:
      'Identify and document the Economic Buyer — the person who controls budget and signs the contract.',
  },
  {
    key: 'decisionCriteria',
    label: 'meddicc.decisionCriteria',
    action:
      'Capture the formal criteria the customer will use to evaluate vendors (security, price, integration, etc.).',
  },
  {
    key: 'decisionProcess',
    label: 'meddicc.decisionProcess',
    action:
      'Document the buying process: who approves, which stakeholders vote, procurement steps, and timeline.',
  },
  {
    key: 'identifyPain',
    label: 'meddicc.identifyPain',
    action: 'Record the core business pain or problem driving this deal in the customer\'s own words.',
  },
  {
    key: 'champion',
    label: 'meddicc.champion',
    action:
      'Identify an internal champion who has influence, urgency, and will advocate for your solution.',
  },
];

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

function checkActivityHistory(deal: DealScoringInput): HygieneAction | null {
  if (!deal.activities || deal.activities.length === 0) {
    return {
      field: 'activities',
      severity: 'BLOCKING',
      message: 'No activity history found for this deal.',
      action:
        'Log at least one interaction (email, meeting, or note) to establish engagement history before scoring.',
    };
  }

  // Warn if the most recent activity is older than 30 days
  const now = Date.now();
  const latestActivity = deal.activities
    .map(a => new Date(a.occurredAt).getTime())
    .sort((a, b) => b - a)[0];

  const daysSinceActivity = (now - latestActivity) / (1000 * 60 * 60 * 24);
  if (daysSinceActivity > 30) {
    return {
      field: 'activities.recency',
      severity: 'WARNING',
      message: `Last activity was ${Math.round(daysSinceActivity)} days ago — deal may be stale.`,
      action: 'Re-engage the prospect and log a fresh touchpoint to confirm deal is still active.',
    };
  }

  return null;
}

function checkMeddiccFields(deal: DealScoringInput): HygieneAction[] {
  if (!deal.meddicc) {
    return MEDDICC_FIELDS.map(f => ({
      field: f.label,
      severity: 'BLOCKING' as HygieneSeverity,
      message: `MEDDICC field "${f.label}" is missing.`,
      action: f.action,
    }));
  }

  return MEDDICC_FIELDS.filter(f => {
    const value = deal.meddicc![f.key];
    return !value || (typeof value === 'string' && value.trim().length === 0);
  }).map(f => ({
    field: f.label,
    severity: 'BLOCKING' as HygieneSeverity,
    message: `MEDDICC field "${f.label}" is missing or empty.`,
    action: f.action,
  }));
}

function checkCloseDate(deal: DealScoringInput): HygieneAction | null {
  if (!deal.closeDate) {
    return {
      field: 'closeDate',
      severity: 'BLOCKING',
      message: 'Close date is not set.',
      action: 'Set a realistic close date that reflects the agreed procurement timeline.',
    };
  }

  const closeDate = new Date(deal.closeDate);
  const now = new Date();

  // Close date in the past for a non-closed deal is a conflict
  if (deal.stage !== 'CLOSED' && closeDate < now) {
    return {
      field: 'closeDate',
      severity: 'BLOCKING',
      message: `Close date (${deal.closeDate}) is in the past but the deal is not marked CLOSED.`,
      action:
        'Update the close date to reflect the current expected close, or mark the deal as CLOSED/LOST.',
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
      message: 'Deal amount is zero or missing.',
      action:
        'Enter the expected deal value. Even a rough estimate is required for risk-level scoring.',
    };
  }
  return null;
}

function checkStage(deal: DealScoringInput): HygieneAction | null {
  if (!deal.stage || deal.stage.trim() === '' || deal.stage === 'UNKNOWN') {
    return {
      field: 'stage',
      severity: 'BLOCKING',
      message: 'Deal stage is missing or unknown.',
      action:
        'Set the current deal stage in your CRM to reflect where the opportunity actually stands.',
    };
  }
  return null;
}

function checkSourceConflict(deal: DealScoringInput): HygieneAction | null {
  if (!deal.sourceOfTruth || deal.sourceOfTruth.length < 2) {
    return null;
  }

  // Look for conflicting stage or amount across sources
  const stages = deal.sourceOfTruth.map(s => s.stage).filter(Boolean);
  const uniqueStages = new Set(stages);

  if (uniqueStages.size > 1) {
    return {
      field: 'sourceOfTruth.stage',
      severity: 'BLOCKING',
      message: `Conflicting stage values across data sources: ${[...uniqueStages].join(', ')}.`,
      action:
        'Reconcile the deal stage between your CRM and other integrated tools to establish a single source of truth.',
    };
  }

  const amounts = deal.sourceOfTruth
    .map(s => parseFloat(s.amount ?? ''))
    .filter(n => !isNaN(n));

  if (amounts.length > 1) {
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    // Flag if variance > 20%
    if ((max - min) / max > 0.2) {
      return {
        field: 'sourceOfTruth.amount',
        severity: 'BLOCKING',
        message: `Deal amount differs significantly across sources (${min} vs ${max}).`,
        action:
          'Align the deal value across all integrated systems. Discrepancies over 20% block accurate scoring.',
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run all hygiene checks against the deal.
 *
 * Returns `{ cannotScore: false }` when the deal is clean enough to score.
 * Returns `{ cannotScore: true, missingFields, hygieneActions }` when
 * blocking issues are found.
 */
export function checkHygiene(deal: DealScoringInput): HygieneResult {
  const actions: HygieneAction[] = [];

  // Run all checks
  const checks: Array<HygieneAction | null> = [
    checkStage(deal),
    checkAmount(deal),
    checkCloseDate(deal),
    checkActivityHistory(deal),
    checkSourceConflict(deal),
    ...checkMeddiccFields(deal),
  ];

  for (const result of checks) {
    if (result) {
      actions.push(result);
    }
  }

  const blockingActions = actions.filter(a => a.severity === 'BLOCKING');

  if (blockingActions.length > 0) {
    return {
      cannotScore: true,
      missingFields: blockingActions.map(a => a.field),
      hygieneActions: actions, // include warnings too for full picture
    };
  }

  return { cannotScore: false };
}
