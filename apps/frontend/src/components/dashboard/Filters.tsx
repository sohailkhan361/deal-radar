import { Filter, Search, SlidersHorizontal } from 'lucide-react';

const filterChips = ['All events', 'Warnings', 'Conflicts', 'High value'];

export function Filters() {
  return (
    <section className="rounded-[2rem] border border-white/70 bg-slate-950 p-4 text-white shadow-2xl shadow-slate-950/20 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.28em] text-cyan-200">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Filters
          </div>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Deal Radar</h1>
        </div>
        <div className="flex flex-1 flex-col gap-3 sm:flex-row lg:max-w-3xl">
          <label className="relative flex-1">
            <span className="sr-only">Search deals</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              className="h-12 w-full rounded-2xl border border-white/10 bg-white/10 pl-12 pr-4 text-sm font-semibold text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-300 focus:bg-white/15"
              placeholder="Search deal, owner, event..."
              type="search"
            />
          </label>
          <button className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 text-sm font-black text-slate-950 transition hover:bg-cyan-200">
            <Filter className="h-4 w-4" aria-hidden="true" />
            Refine
          </button>
        </div>
      </div>
      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {filterChips.map(chip => (
          <button className="shrink-0 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-200 transition hover:border-cyan-200 hover:text-cyan-100" key={chip}>
            {chip}
          </button>
        ))}
      </div>
    </section>
  );
}
