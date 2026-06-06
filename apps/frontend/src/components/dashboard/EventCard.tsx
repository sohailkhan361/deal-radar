import { CalendarClock, Mail, MessageSquareText, MoveRight, NotebookText } from 'lucide-react';

export type ActivityEvent = {
  id: string;
  type: 'stage_changed' | 'email_sent' | 'meeting_booked' | 'note_added';
  dealName: string;
  title: string;
  description: string;
  time: string;
  actor: string;
  status: 'clean' | 'warning' | 'conflict';
};

const eventMeta = {
  stage_changed: {
    label: 'Stage changed',
    icon: MoveRight,
    tone: 'bg-cyan-100 text-cyan-800 ring-cyan-200',
  },
  email_sent: {
    label: 'Email sent',
    icon: Mail,
    tone: 'bg-amber-100 text-amber-800 ring-amber-200',
  },
  meeting_booked: {
    label: 'Meeting booked',
    icon: CalendarClock,
    tone: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  },
  note_added: {
    label: 'Note added',
    icon: NotebookText,
    tone: 'bg-rose-100 text-rose-800 ring-rose-200',
  },
} satisfies Record<ActivityEvent['type'], { label: string; icon: typeof MessageSquareText; tone: string }>;

const statusStyles = {
  clean: 'border-slate-200 bg-white/80',
  warning: 'border-amber-300 bg-amber-50/80',
  conflict: 'border-rose-300 bg-rose-50/80',
};

export function EventCard({ event }: { event: ActivityEvent }) {
  const meta = eventMeta[event.type];
  const Icon = meta.icon;

  return (
    <article className={`group rounded-3xl border p-4 shadow-sm shadow-slate-200/60 backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-300/40 ${statusStyles[event.status]}`}>
      <div className="flex items-start gap-4">
        <div className={`rounded-2xl p-3 ring-1 ${meta.tone}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-white">
              {meta.label}
            </span>
            <span className="text-xs font-semibold text-slate-500">{event.time}</span>
          </div>
          <h3 className="mt-3 text-lg font-black tracking-tight text-slate-950">{event.title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">{event.description}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
            <span>{event.dealName}</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span>{event.actor}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
