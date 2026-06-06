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
  DealListItemResponse,
  DealResponse,
  DealState,
  HygieneAction,
  HygieneCategory,
  MeddiccFields,
  PaginationMeta,
  PaginatedDealsResponse,
  PaginatedDealDetailResponse,
} from './deals';

export interface Deal {
  id: string;
  title: string;
  description: string;
  status: 'PENDING' | 'ACTIVE' | 'CLOSED';
  createdAt: Date;
  updatedAt: Date;
}
