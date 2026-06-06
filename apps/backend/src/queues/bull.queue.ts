/**
 * deal-events queue.
 *
 * DealEventType is authoritative in @deal-radar/shared-types/sse.ts —
 * we import from there to avoid drift.
 */

import type { DealEventType } from '@deal-radar/shared-types';
import { queueService } from './queue.service';

export const DEAL_EVENTS_QUEUE_NAME = 'deal-events';

export type DealEventJobData = {
  eventId: string;
  dealId: string;
  eventType: DealEventType;
  payload: Record<string, unknown>;
  occurredAt?: string;
};

export type DealEventJobResult = void;
export type DealEventJobName = 'deal-event-received';

// Re-export so consumers only need one import
export type { DealEventType };

export const dealEventsQueue = queueService.createQueue<
  DealEventJobData,
  DealEventJobResult,
  DealEventJobName
>(DEAL_EVENTS_QUEUE_NAME);
