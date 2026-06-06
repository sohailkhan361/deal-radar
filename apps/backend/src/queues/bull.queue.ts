import { queueService } from './queue.service';

export const DEAL_EVENTS_QUEUE_NAME = 'deal-events';

export type DealEventJobData = {
  eventId: string;
  dealId: string;
  eventType: string;
  payload: Record<string, unknown>;
  occurredAt?: string;
};
export type DealEventJobResult = void;
export type DealEventJobName = 'deal-event-received';

export const dealEventsQueue = queueService.createQueue<
  DealEventJobData,
  DealEventJobResult,
  DealEventJobName
>(DEAL_EVENTS_QUEUE_NAME);
