import { create } from 'zustand';
import type {
  DealEventType,
  SseConnectedPayload,
  SseDealEventProcessedPayload,
  SseEventName,
} from '@deal-radar/shared-types';

export const MAX_STREAM_EVENTS = 1000;

export type StreamEvent =
  | {
      id: string;
      name: 'connected';
      receivedAt: string;
      payload: SseConnectedPayload;
    }
  | {
      id: string;
      name: 'deal-event-processed';
      receivedAt: string;
      payload: SseDealEventProcessedPayload;
    };

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'paused';

type EventStreamState = {
  events: StreamEvent[];
  connectionStatus: ConnectionStatus;
  isPaused: boolean;
  eventTypeFilter: DealEventType | 'all';
  autoScroll: boolean;
  lastHeartbeatAt: string | null;
  addEvent: (name: SseEventName, payload: unknown) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setPaused: (paused: boolean) => void;
  setEventTypeFilter: (filter: DealEventType | 'all') => void;
  setAutoScroll: (enabled: boolean) => void;
  setLastHeartbeatAt: (timestamp: string) => void;
  clearEvents: () => void;
};

const shouldStoreEvent = (name: SseEventName) => name === 'connected' || name === 'deal-event-processed';

export const useEventStreamStore = create<EventStreamState>((set) => ({
  events: [],
  connectionStatus: 'disconnected',
  isPaused: false,
  eventTypeFilter: 'all',
  autoScroll: true,
  lastHeartbeatAt: null,

  addEvent: (name, payload) => {
    if (!shouldStoreEvent(name)) {
      return;
    }

    const event: StreamEvent =
      name === 'connected'
        ? {
            id: `connected-${Date.now()}`,
            name,
            receivedAt: new Date().toISOString(),
            payload: payload as SseConnectedPayload,
          }
        : {
            id: (payload as SseDealEventProcessedPayload).eventId,
            name,
            receivedAt: new Date().toISOString(),
            payload: payload as SseDealEventProcessedPayload,
          };

    set((state) => ({
      events: [event, ...state.events].slice(0, MAX_STREAM_EVENTS),
    }));
  },

  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  setPaused: (isPaused) =>
    set({
      isPaused,
      connectionStatus: isPaused ? 'paused' : 'disconnected',
    }),
  setEventTypeFilter: (eventTypeFilter) => set({ eventTypeFilter }),
  setAutoScroll: (autoScroll) => set({ autoScroll }),
  setLastHeartbeatAt: (lastHeartbeatAt) => set({ lastHeartbeatAt }),
  clearEvents: () => set({ events: [] }),
}));

export const selectFilteredEvents = (state: EventStreamState) => {
  if (state.eventTypeFilter === 'all') {
    return state.events;
  }

  return state.events.filter(
    (event) =>
      event.name === 'deal-event-processed' && event.payload.eventType === state.eventTypeFilter,
  );
};
