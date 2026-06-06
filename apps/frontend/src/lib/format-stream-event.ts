import type { DealEventType } from '@deal-radar/shared-types';
import type { ActivityEvent } from '../components/dashboard/EventCard';
import type { StreamEvent } from '../store/event-stream';

const dealLabels: Record<string, string> = {
  'deal-acme-001': 'Acme Expansion',
  'deal-globex-002': 'Globex Renewal',
  'deal-initech-003': 'Initech Platform',
  'deal-umbrella-004': 'Umbrella Pilot',
};

const eventTitles: Record<DealEventType, string> = {
  stage_changed: 'Deal stage updated',
  email_sent: 'Outbound email logged',
  meeting_booked: 'Meeting scheduled',
  note_added: 'Note added to deal',
  deal_closed: 'Deal closed',
};

const formatRelativeTime = (isoDate: string) => {
  const deltaMs = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.max(1, Math.round(deltaMs / 60_000));

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.round(minutes / 60);
  return `${hours} hr ago`;
};

export const formatStreamEvent = (event: StreamEvent): ActivityEvent | null => {
  if (event.name !== 'deal-event-processed') {
    return null;
  }

  const { eventId, dealId, eventType, processedAt } = event.payload;

  return {
    id: eventId,
    type: eventType,
    dealName: dealLabels[dealId] ?? dealId,
    title: eventTitles[eventType],
    description: `Processed at ${new Date(processedAt).toLocaleTimeString()}. Event type: ${eventType}.`,
    time: formatRelativeTime(processedAt),
    actor: 'deal-radar',
    status: 'clean',
  };
};
