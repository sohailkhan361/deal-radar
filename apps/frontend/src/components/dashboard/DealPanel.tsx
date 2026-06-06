'use client';

import type { DealHygieneInfo, DealListItemResponse, HygieneAction } from '@deal-radar/shared-types';
import {
  AlertTriangle,
  Activity,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  Clock,
  DollarSign,
  Layers,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { useDeals } from '../../hooks/useDeals';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  MEDDICC: 'MEDDICC',
  ACTIVITY: 'Activity',
  CLOSE_DATE: 'Close Date',
  DEAL_VALUE: 'Deal Value',
  STAGE: 'Stage',
  SOURCE_CONFLICT: 'Source Conflict',
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  MEDDICC: BookOpen,
  ACTIVITY: Activity,
  CLOSE_DATE: Calendar,
  DEAL_VALUE: DollarSign,
  STAGE: Layers,
  SOURCE_CONFLICT: AlertTriangle,
};

function formatAmount(amount: string): string {
  const n = parseFloat(amount);
  if (isNaN(n)) return amount;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function scoreColor(score: number | null): string {
  if (score === null) return '#94a3b8';
  if (score >= 0.75) return '#34d399';
  if (score >= 0.45) return '#fbbf24';
  return '#f87171';
}

function scoreBg(score: number | null): string {
  if (score === null) return 'bg-slate-100 text-slate-500';
  if (score >= 0.75) return 'bg-emerald-50 text-emerald-700';
  if (score >= 0.45) return 'bg-amber-50 text-amber-700';
  return 'bg-rose-50 text-rose-700';
}

// ---------------------------------------------------------------------------
// Score ring SVG
// ---------------------------------------------------------------------------

function ScoreRing({ score }: { score: number | null }) {
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const pct = score !== null ? Math.min(1, Math.max(0, score)) : 0;
  const dash = pct * circ;
  const color = scoreColor(score);
  const label = score !== null ? Math.round(score * 100) : '—';

  return (
    <div className="relative flex items-center justify-center" style={{ width: 72, height: 72 }}>
      <svg width="72" height="72" className="-rotate-90" aria-hidden="true">
        <circle cx="36" cy="36" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="5" />
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <span
        className="absolute text-sm font-black tabular-nums"
        style={{ color }}
      >
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Risk badge
// ---------------------------------------------------------------------------

const RISK_META: Record<string, { label: string; bg: string; icon: React.ElementType }> = {
  LOW: { label: 'Low Risk', bg: 'bg-emerald-100 text-emerald-800 ring-emerald-200', icon: ShieldCheck },
  MEDIUM: { label: 'Medium Risk', bg: 'bg-amber-100 text-amber-800 ring-amber-200', icon: ShieldAlert },
  HIGH: { label: 'High Risk', bg: 'bg-rose-100 text-rose-800 ring-rose-200', icon: ShieldX },
};

function RiskBadge({ level }: { level: string | null }) {
  if (!level) return null;
  const meta = RISK_META[level] ?? RISK_META.MEDIUM;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ring-1 ${meta.bg}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {meta.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Hygiene action item
// ---------------------------------------------------------------------------

function HygieneActionItem({ action }: { action: HygieneAction }) {
  const [open, setOpen] = useState(false);
  const Icon = CATEGORY_ICONS[action.category] ?? AlertTriangle;
  const isBlocking = action.severity === 'BLOCKING';

  return (
    <div className={`rounded-2xl border p-3 ${isBlocking ? 'border-rose-200 bg-rose-50/70' : 'border-amber-200 bg-amber-50/70'}`}>
      <button
        className="flex w-full items-start gap-3 text-left"
        onClick={() => setOpen(v => !v)}
        type="button"
        aria-expanded={open}
      >
        <div className={`mt-0.5 shrink-0 rounded-xl p-1.5 ${isBlocking ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] ${isBlocking ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
              {isBlocking ? 'Blocking' : 'Warning'}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
              {CATEGORY_LABELS[action.category] ?? action.category}
            </span>
          </div>
          <p className="mt-1 text-xs font-semibold leading-snug text-slate-700">{action.message}</p>
        </div>
        <div className="mt-1 shrink-0 text-slate-400">
          {open
            ? <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
        </div>
      </button>
      {open && (
        <div className={`mt-2 ml-8 rounded-xl px-3 py-2 text-xs leading-relaxed text-slate-700 ${isBlocking ? 'bg-rose-100/60' : 'bg-amber-100/60'}`}>
          <span className="font-black">Action: </span>{action.action}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hygiene warning card (cannotScore = true)
// ---------------------------------------------------------------------------

function HygieneCard({ hygiene }: { hygiene: DealHygieneInfo }) {
  const blocking = hygiene.hygieneActions.filter((a: HygieneAction) => a.severity === 'BLOCKING');
  const warnings = hygiene.hygieneActions.filter((a: HygieneAction) => a.severity === 'WARNING');

  return (
    <div className="rounded-3xl border border-rose-200 bg-rose-50/60 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-rose-100 p-2.5 ring-1 ring-rose-200">
          <ShieldX className="h-5 w-5 text-rose-600" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-black text-rose-800">Cannot Score</p>
          <p className="mt-0.5 text-xs font-semibold text-rose-600">
            {blocking.length} blocking issue{blocking.length !== 1 ? 's' : ''} must be resolved
          </p>
        </div>
      </div>

      {/* Missing fields chips */}
      {hygiene.missingFields.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {hygiene.missingFields.map(f => (
            <span
              key={f}
              className="rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-rose-700 ring-1 ring-rose-200"
            >
              {f.replace('meddicc.', '').replace(/([A-Z])/g, ' $1').trim()}
            </span>
          ))}
        </div>
      )}

      {/* Actions list */}
      {hygiene.hygieneActions.length > 0 && (
        <div className="mt-3 space-y-2">
          {blocking.map((action, i) => (
            <HygieneActionItem key={`b-${i}`} action={action} />
          ))}
          {warnings.map((action, i) => (
            <HygieneActionItem key={`w-${i}`} action={action} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hygiene warnings card (cannotScore = false but warnings exist)
// ---------------------------------------------------------------------------

function WarningsCard({ actions }: { actions: HygieneAction[] }) {
  if (actions.length === 0) return null;
  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50/60 p-4">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
        <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">
          {actions.length} hygiene warning{actions.length !== 1 ? 's' : ''}
        </p>
      </div>
      <div className="space-y-2">
        {actions.map((action, i) => (
          <HygieneActionItem key={i} action={action} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single deal card
// ---------------------------------------------------------------------------

function DealCard({ deal }: { deal: DealListItemResponse }) {
  const { health, state } = deal;
  const { hygiene } = health;
  const cannotScore = hygiene.cannotScore;
  const warnings = hygiene.hygieneActions.filter((a: HygieneAction) => a.severity === 'WARNING');
  const [expanded, setExpanded] = useState(false);

  const validationLabel =
    health.validationStatus === 'HYGIENE_FAIL'
      ? 'Hygiene Fail'
      : health.validationStatus === 'SCORED'
        ? 'Scored'
        : health.validationStatus === 'PENDING'
          ? 'Pending'
          : health.validationStatus;

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 shadow-sm shadow-slate-200/60 backdrop-blur">
      {/* Header row */}
      <div className="flex items-center gap-3 p-4">
        <ScoreRing score={cannotScore ? null : health.healthScore} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black text-slate-900 truncate">{deal.dealId}</p>
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] ring-1 ${scoreBg(cannotScore ? null : health.healthScore)}`}>
              {validationLabel}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 font-semibold">
            <span className="rounded-full bg-slate-100 px-2 py-0.5">{state.stage}</span>
            <span>{formatAmount(state.amount)}</span>
            <span>Close {formatDate(state.closeDate)}</span>
          </div>
        </div>
        <button
          className="ml-1 rounded-2xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse deal detail' : 'Expand deal detail'}
          type="button"
        >
          {expanded
            ? <ChevronUp className="h-4 w-4" aria-hidden="true" />
            : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>

      {/* Risk badge row */}
      {!cannotScore && health.riskLevel && (
        <div className="px-4 pb-3 flex items-center gap-2">
          <RiskBadge level={health.riskLevel} />
          {health.recommendedAction && (
            <p className="text-xs font-semibold text-slate-500 line-clamp-1 flex-1">{health.recommendedAction}</p>
          )}
        </div>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
          {/* Cannot score — full hygiene card */}
          {cannotScore && <HygieneCard hygiene={hygiene} />}

          {/* AI reasoning */}
          {!cannotScore && health.aiReasoning && (
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Zap className="h-3.5 w-3.5 text-cyan-600" aria-hidden="true" />
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-700">AI Reasoning</p>
              </div>
              <p className="text-xs leading-relaxed text-slate-600">{health.aiReasoning}</p>
            </div>
          )}

          {/* Recommended action */}
          {!cannotScore && health.recommendedAction && (
            <div className="rounded-2xl bg-cyan-50 border border-cyan-200 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="h-3.5 w-3.5 text-cyan-600" aria-hidden="true" />
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-700">Next Step</p>
              </div>
              <p className="text-xs font-semibold leading-relaxed text-cyan-900">{health.recommendedAction}</p>
            </div>
          )}

          {/* Non-blocking warnings on a scored deal */}
          {!cannotScore && warnings.length > 0 && (
            <WarningsCard actions={warnings} />
          )}

          {/* Last hygiene check timestamp */}
          {hygiene.lastHygieneAt && (
            <p className="flex items-center gap-1 text-[10px] font-semibold text-slate-400">
              <Clock className="h-3 w-3" aria-hidden="true" />
              Last hygiene check {formatDate(hygiene.lastHygieneAt)}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Summary header card
// ---------------------------------------------------------------------------

function SummaryCard({ deals }: { deals: DealListItemResponse[] }) {
  const scored = deals.filter(d => d.health.validationStatus === 'SCORED');
  const failed = deals.filter(d => d.health.validationStatus === 'HYGIENE_FAIL');
  const avgScore =
    scored.length > 0
      ? scored.reduce((sum, d) => sum + (d.health.healthScore ?? 0), 0) / scored.length
      : null;
  const totalRevenue = deals.reduce((sum, d) => sum + parseFloat(d.state.amount), 0);
  const highRisk = scored.filter(d => d.health.riskLevel === 'HIGH').length;

  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-900 bg-[radial-gradient(circle_at_20%_0%,#67e8f9_0,#0f172a_34%,#020617_100%)] p-6 text-white shadow-2xl shadow-slate-950/30">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-200">Deal Health</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight">Pipeline pulse</h2>
        </div>
        <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15">
          {failed.length > 0
            ? <ShieldX className="h-6 w-6 text-rose-300" aria-hidden="true" />
            : <ShieldCheck className="h-6 w-6 text-emerald-300" aria-hidden="true" />}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4">
        <div className="rounded-3xl bg-white/10 p-4 ring-1 ring-white/10">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">Avg health</p>
          <p className="mt-2 text-5xl font-black tracking-tighter">
            {avgScore !== null ? Math.round(avgScore * 100) : '—'}
          </p>
        </div>
        <div className="rounded-3xl bg-cyan-300 p-4 text-slate-950">
          <p className="text-xs font-black uppercase tracking-[0.18em]">Revenue watched</p>
          <p className="mt-2 text-4xl font-black tracking-tighter">{formatAmount(String(totalRevenue))}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-white/8 p-3 ring-1 ring-white/10 text-center">
          <p className="text-2xl font-black">{scored.length}</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-300 mt-0.5">Scored</p>
        </div>
        <div className="rounded-2xl bg-rose-500/20 p-3 ring-1 ring-rose-400/30 text-center">
          <p className="text-2xl font-black text-rose-200">{failed.length}</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-rose-300 mt-0.5">Failing</p>
        </div>
        <div className="rounded-2xl bg-amber-500/20 p-3 ring-1 ring-amber-400/30 text-center">
          <p className="text-2xl font-black text-amber-200">{highRisk}</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300 mt-0.5">High risk</p>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-3xl border border-slate-200 bg-white/60 p-4">
      <div className="flex items-center gap-3">
        <div className="h-[72px] w-[72px] rounded-full bg-slate-200" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 rounded-full bg-slate-200" />
          <div className="h-3 w-48 rounded-full bg-slate-200" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white/60 p-8 text-center">
      <CircleDashed className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
      <p className="mt-3 text-sm font-black text-slate-500">No deals yet</p>
      <p className="mt-1 text-xs text-slate-400">Send a webhook event to get started.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-3xl border border-rose-200 bg-rose-50/60 p-6 text-center">
      <TrendingDown className="mx-auto h-7 w-7 text-rose-400" aria-hidden="true" />
      <p className="mt-3 text-sm font-black text-rose-700">Could not load deals</p>
      <p className="mt-1 text-xs text-rose-500">Check that the backend is running.</p>
      <button
        className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-rose-100 px-4 py-2 text-xs font-black text-rose-700 ring-1 ring-rose-200 transition hover:bg-rose-200"
        onClick={onRetry}
        type="button"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        Retry
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main DealPanel
// ---------------------------------------------------------------------------

export function DealPanel() {
  const { data, isLoading, isError, refetch, isFetching } = useDeals();
  const deals = data?.data ?? [];

  return (
    <aside className="space-y-5">
      {/* Summary header — always show, even while loading */}
      {deals.length > 0 ? (
        <SummaryCard deals={deals} />
      ) : (
        <section className="overflow-hidden rounded-[2rem] border border-slate-900 bg-[radial-gradient(circle_at_20%_0%,#67e8f9_0,#0f172a_34%,#020617_100%)] p-6 text-white shadow-2xl shadow-slate-950/30">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-200">Deal Health</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">Pipeline pulse</h2>
            </div>
            <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15">
              <CheckCircle2 className="h-6 w-6 text-emerald-300" aria-hidden="true" />
            </div>
          </div>
        </section>
      )}

      {/* Deals list */}
      <section className="rounded-[2rem] border border-white/70 bg-white/75 p-5 shadow-xl shadow-slate-300/30 backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-950">Watched deals</h3>
          <div className="flex items-center gap-2">
            {isFetching && !isLoading && (
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-cyan-500" aria-label="Refreshing" />
            )}
            {data && (
              <span className="text-xs font-bold text-slate-400">
                {deals.length} / {data.pagination.total}
              </span>
            )}
          </div>
        </div>

        {isLoading && (
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {isError && <ErrorState onRetry={() => refetch()} />}

        {!isLoading && !isError && deals.length === 0 && <EmptyState />}

        {!isLoading && !isError && deals.length > 0 && (
          <div className="space-y-3">
            {deals.map(deal => (
              <DealCard key={deal.dealId} deal={deal} />
            ))}
          </div>
        )}
      </section>

      {/* Hygiene summary — quick overview when issues exist */}
      {deals.length > 0 && (() => {
        const failing = deals.filter(d => d.health.hygiene.cannotScore);
        const withWarnings = deals.filter(
          d => !d.health.hygiene.cannotScore && d.health.hygiene.hygieneActions.length > 0,
        );
        if (failing.length === 0 && withWarnings.length === 0) return null;
        return (
          <section className="rounded-[2rem] border border-white/70 bg-white/75 p-5 shadow-xl shadow-slate-300/30 backdrop-blur-xl">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-4 w-4 text-slate-600" aria-hidden="true" />
              <h3 className="text-lg font-black text-slate-950">Hygiene summary</h3>
            </div>
            <div className="space-y-2">
              {failing.length > 0 && (
                <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3">
                  <ShieldX className="h-4 w-4 shrink-0 text-rose-500" aria-hidden="true" />
                  <p className="text-sm font-semibold text-rose-800">
                    <span className="font-black">{failing.length}</span> deal{failing.length !== 1 ? 's' : ''} blocked from scoring
                  </p>
                </div>
              )}
              {withWarnings.length > 0 && (
                <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
                  <p className="text-sm font-semibold text-amber-800">
                    <span className="font-black">{withWarnings.length}</span> deal{withWarnings.length !== 1 ? 's' : ''} scored with hygiene warnings
                  </p>
                </div>
              )}
            </div>
          </section>
        );
      })()}
    </aside>
  );
}
