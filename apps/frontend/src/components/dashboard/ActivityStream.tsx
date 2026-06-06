'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { DealEventType } from '@deal-radar/shared-types';
import { ArrowDown, Pause, Play } from 'lucide-react';
import { useEventStream } from '../../hooks/useEventStream';
import { formatStreamEvent } from '../../lib/format-stream-event';
import { selectFilteredEvents, useEventStreamStore } from '../../store/event-stream';
import { EventCard } from './EventCard';

const EVENT_TYPE_FILTERS: Array<{ value: DealEventType | 'all'; label: string }> = [
  { value: 'all', label: 'All events' },
  { value: 'stage_changed', label: 'Stage changed' },
  { value: 'email_sent', label: 'Email sent' },
  { value: 'meeting_booked', label: 'Meeting booked' },
  { value: 'note_added', label: 'Note added' },
  { value: 'deal_closed', label: 'Deal closed' },
];

const statusStyles = {
  connected: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  connecting: 'bg-amber-100 text-amber-800 ring-amber-200',
  disconnected: 'bg-slate-100 text-slate-700 ring-slate-200',
  paused: 'bg-rose-100 text-rose-800 ring-rose-200',
} as const;

export function ActivityStream() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const {
    connectionStatus,
    isPaused,
    eventTypeFilter,
    autoScroll,
    pause,
    resume,
    setEventTypeFilter,
    setAutoScroll,
  } = useEventStream();

  const filteredEvents = useEventStreamStoreFiltered();
  const displayEvents = useMemo(
    () =>
      filteredEvents
        .map(formatStreamEvent)
        .filter((event): event is NonNullable<typeof event> => event !== null),
    [filteredEvents],
  );

  useEffect(() => {
    if (!autoScroll || !scrollRef.current) {
      return;
    }

    scrollRef.current.scrollTop = 0;
  }, [autoScroll, displayEvents.length, displayEvents[0]?.id]);

  return (
    <section className="rounded-[2rem] border border-white/70 bg-white/70 p-4 shadow-2xl shadow-slate-300/30 backdrop-blur-xl sm:p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-700">Live feed</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Activity Stream</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.18em] ring-1 ${statusStyles[connectionStatus]}`}
          >
            {connectionStatus}
          </span>
          <button
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-slate-700 transition hover:border-slate-300"
            onClick={isPaused ? resume : pause}
            type="button"
          >
            {isPaused ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : <Pause className="h-3.5 w-3.5" aria-hidden="true" />}
            {isPaused ? 'Resume' : 'Pause'}
          </button>
          <button
            aria-pressed={autoScroll}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] transition ${
              autoScroll
                ? 'border-cyan-200 bg-cyan-50 text-cyan-800'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
            }`}
            onClick={() => setAutoScroll(!autoScroll)}
            type="button"
          >
            <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
            Auto-scroll
          </button>
        </div>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {EVENT_TYPE_FILTERS.map((filter) => (
          <button
            className={`shrink-0 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.16em] transition ${
              eventTypeFilter === filter.value
                ? 'border-slate-950 bg-slate-950 text-white'
                : 'border-slate-200 bg-white/80 text-slate-600 hover:border-slate-300'
            }`}
            key={filter.value}
            onClick={() => setEventTypeFilter(filter.value)}
            type="button"
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="max-h-[42rem] space-y-4 overflow-y-auto pr-1" ref={scrollRef}>
        {displayEvents.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white/60 p-8 text-center text-sm font-semibold text-slate-500">
            {isPaused ? 'Stream paused. Resume to receive new events.' : 'Waiting for live deal events...'}
          </div>
        ) : (
          displayEvents.map((event) => <EventCard event={event} key={event.id} />)
        )}
      </div>
    </section>
  );
}

function useEventStreamStoreFiltered() {
  return useEventStreamStore(selectFilteredEvents);
}
