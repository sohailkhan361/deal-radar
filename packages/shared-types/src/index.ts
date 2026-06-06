export type {
  DealEventType,
  SseConnectedPayload,
  SseHeartbeatPayload,
  SseDealEventProcessedPayload,
  SseEventName,
} from './sse';

export type {
  ActivityResponse,
  DealDetailResponse,
  DealHealthFields,
  DealHygieneInfo,
  DealResponse,
  DealState,
  HygieneAction,
  MeddiccFields,
  PaginationMeta,
} from './deals';

export interface Deal {
  id: string;
  title: string;
  description: string;
  status: 'PENDING' | 'ACTIVE' | 'CLOSED';
  createdAt: Date;
  updatedAt: Date;
}
