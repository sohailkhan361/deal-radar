import type { SseEventName } from '@deal-radar/shared-types';
import { useEventStreamStore } from '../store/event-stream';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type SseListener = {
  event: SseEventName;
  handler: (data: unknown) => void;
};

class SseClient {
  private eventSource: EventSource | null = null;
  private readonly url: string;
  private readonly listeners: SseListener[] = [];

  constructor(url = `${API_BASE_URL}/api/events/stream`) {
    this.url = url;
    this.registerDefaultListeners();
  }

  connect() {
    const { isPaused } = useEventStreamStore.getState();

    if (isPaused || this.eventSource) {
      return;
    }

    const store = useEventStreamStore.getState();
    store.setConnectionStatus('connecting');

    const eventSource = new EventSource(this.url);
    this.eventSource = eventSource;

    for (const listener of this.listeners) {
      eventSource.addEventListener(listener.event, (message) => {
        try {
          const data = JSON.parse(message.data) as unknown;
          listener.handler(data);
        } catch (error) {
          console.error('[sse] Failed to parse event payload', {
            event: listener.event,
            error,
          });
        }
      });
    }

    eventSource.onopen = () => {
      if (!useEventStreamStore.getState().isPaused) {
        useEventStreamStore.getState().setConnectionStatus('connected');
      }
    };

    eventSource.onerror = () => {
      const { isPaused: paused } = useEventStreamStore.getState();

      if (paused) {
        this.disconnect();
        return;
      }

      if (eventSource.readyState === EventSource.CLOSED) {
        useEventStreamStore.getState().setConnectionStatus('disconnected');
        this.eventSource = null;
      }
    };
  }

  disconnect() {
    this.eventSource?.close();
    this.eventSource = null;
  }

  pause() {
    const store = useEventStreamStore.getState();
    store.setPaused(true);
    this.disconnect();
  }

  resume() {
    useEventStreamStore.getState().setPaused(false);
  }

  private registerDefaultListeners() {
    const store = () => useEventStreamStore.getState();

    this.listeners.push(
      {
        event: 'connected',
        handler: (data) => {
          store().addEvent('connected', data);
          store().setConnectionStatus('connected');
        },
      },
      {
        event: 'heartbeat',
        handler: (data) => {
          const payload = data as { timestamp?: string };
          store().setLastHeartbeatAt(payload.timestamp ?? new Date().toISOString());
        },
      },
      {
        event: 'deal-event-processed',
        handler: (data) => {
          store().addEvent('deal-event-processed', data);
        },
      },
    );
  }
}

export const sseClient = new SseClient();
