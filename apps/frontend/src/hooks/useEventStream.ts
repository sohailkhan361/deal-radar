'use client';

import { useEffect } from 'react';
import { sseClient } from '../lib/sse-client';
import { useEventStreamStore } from '../store/event-stream';

export function useEventStream() {
  const isPaused = useEventStreamStore((state) => state.isPaused);
  const connectionStatus = useEventStreamStore((state) => state.connectionStatus);
  const events = useEventStreamStore((state) => state.events);
  const eventTypeFilter = useEventStreamStore((state) => state.eventTypeFilter);
  const autoScroll = useEventStreamStore((state) => state.autoScroll);
  const lastHeartbeatAt = useEventStreamStore((state) => state.lastHeartbeatAt);
  const setEventTypeFilter = useEventStreamStore((state) => state.setEventTypeFilter);
  const setAutoScroll = useEventStreamStore((state) => state.setAutoScroll);

  useEffect(() => {
    if (isPaused) {
      return;
    }

    sseClient.connect();

    return () => {
      sseClient.disconnect();
    };
  }, [isPaused]);

  return {
    events,
    connectionStatus,
    isPaused,
    eventTypeFilter,
    autoScroll,
    lastHeartbeatAt,
    pause: () => sseClient.pause(),
    resume: () => sseClient.resume(),
    setEventTypeFilter,
    setAutoScroll,
  };
}
