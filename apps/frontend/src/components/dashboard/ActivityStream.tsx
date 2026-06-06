import { EventCard, type ActivityEvent } from './EventCard';

const events: ActivityEvent[] = [
  {
    id: 'evt-001',
    type: 'stage_changed',
    dealName: 'Acme Expansion',
    title: 'Discovery moved to proposal',
    description: 'CRM stage was updated after the technical validation call. Close date remains inside the quarter.',
    time: '2 min ago',
    actor: 'mock-crm',
    status: 'clean',
  },
  {
    id: 'evt-002',
    type: 'email_sent',
    dealName: 'Globex Renewal',
    title: 'Pricing follow-up sent',
    description: 'Rep sent procurement a pricing clarification. This event arrived before the prior meeting history.',
    time: '6 min ago',
    actor: 'rep-a',
    status: 'warning',
  },
  {
    id: 'evt-003',
    type: 'meeting_booked',
    dealName: 'Initech Platform',
    title: 'Executive alignment booked',
    description: 'Eight attendees invited, including economic buyer and security lead. Strong buying signal.',
    time: '11 min ago',
    actor: 'calendar-sync',
    status: 'clean',
  },
  {
    id: 'evt-004',
    type: 'note_added',
    dealName: 'Umbrella Pilot',
    title: 'Source conflict detected',
    description: 'Salesforce shadow record says negotiation while CRM primary says closed lost. Needs reconciliation.',
    time: '18 min ago',
    actor: 'manager-a',
    status: 'conflict',
  },
];

export function ActivityStream() {
  return (
    <section className="rounded-[2rem] border border-white/70 bg-white/70 p-4 shadow-2xl shadow-slate-300/30 backdrop-blur-xl sm:p-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-700">Live feed</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Activity Stream</h2>
        </div>
        <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-emerald-800 ring-1 ring-emerald-200">
          Static preview
        </div>
      </div>
      <div className="space-y-4">
        {events.map(event => (
          <EventCard event={event} key={event.id} />
        ))}
      </div>
    </section>
  );
}
