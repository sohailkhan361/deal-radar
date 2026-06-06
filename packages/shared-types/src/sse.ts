export type DealEventType =
  | 'stage_changed'
  | 'email_sent'
  | 'meeting_booked'
  | 'note_added'
  | 'deal_closed';

export type SseConnectedPayload = {
  clientId: string;
  activeClients: number;
};

export type SseHeartbeatPayload = {
  timestamp: string;
};

export type SseDealEventProcessedPayload = {
  eventId: string;
  dealId: string;
  eventType: DealEventType;
  processedAt: string;
};

export type SseEventName = 'connected' | 'heartbeat' | 'deal-event-processed';
