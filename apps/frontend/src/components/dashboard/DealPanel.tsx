import { AlertTriangle, CheckCircle2, Radar, TrendingUp } from 'lucide-react';

const healthSignals = [
  { label: 'Momentum', value: '82', detail: '3 buying signals in 24h', tone: 'text-emerald-700', icon: TrendingUp },
  { label: 'Risk', value: 'Medium', detail: '1 source conflict open', tone: 'text-amber-700', icon: AlertTriangle },
  { label: 'Validation', value: 'Pending', detail: 'Awaiting activity history', tone: 'text-cyan-700', icon: Radar },
];

const deals = [
  { name: 'Acme Expansion', score: 91, stage: 'Proposal', amount: '$120k' },
  { name: 'Initech Platform', score: 78, stage: 'Discovery', amount: '$75k' },
  { name: 'Globex Renewal', score: 64, stage: 'Negotiation', amount: '$48k' },
];

export function DealPanel() {
  return (
    <aside className="space-y-5">
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
        <div className="mt-8 grid grid-cols-2 gap-4">
          <div className="rounded-3xl bg-white/10 p-4 ring-1 ring-white/10">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">Health score</p>
            <p className="mt-2 text-5xl font-black tracking-tighter">78</p>
          </div>
          <div className="rounded-3xl bg-cyan-300 p-4 text-slate-950">
            <p className="text-xs font-black uppercase tracking-[0.18em]">Revenue watched</p>
            <p className="mt-2 text-4xl font-black tracking-tighter">$243k</p>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/75 p-5 shadow-xl shadow-slate-300/30 backdrop-blur-xl">
        <h3 className="text-lg font-black text-slate-950">Signals</h3>
        <div className="mt-4 space-y-3">
          {healthSignals.map(signal => {
            const Icon = signal.icon;

            return (
              <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-white/80 p-4" key={signal.label}>
                <div className="rounded-2xl bg-slate-100 p-3">
                  <Icon className={`h-5 w-5 ${signal.tone}`} aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-950">{signal.label}: {signal.value}</p>
                  <p className="text-xs font-semibold text-slate-500">{signal.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/75 p-5 shadow-xl shadow-slate-300/30 backdrop-blur-xl">
        <h3 className="text-lg font-black text-slate-950">Watched deals</h3>
        <div className="mt-4 space-y-4">
          {deals.map(deal => (
            <div key={deal.name}>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-black text-slate-900">{deal.name}</span>
                <span className="font-black text-slate-500">{deal.amount}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${deal.score}%` }} />
              </div>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{deal.stage} · {deal.score}%</p>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}
