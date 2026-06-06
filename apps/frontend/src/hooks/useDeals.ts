'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { fetchDeals, type DealsPage } from '../lib/api';
import { useEventStreamStore } from '../store/event-stream';

export const DEALS_QUERY_KEY = ['deals'] as const;

/**
 * Fetches the deals list and keeps it fresh.
 *
 * - Polls every 30 s as a baseline.
 * - Also invalidates immediately whenever the SSE stream delivers a
 *   new `deal-event-processed` event, so scores/hygiene update in near real-time.
 */
export function useDeals(page = 1, limit = 20) {
  const queryClient = useQueryClient();
  const events = useEventStreamStore((state) => state.events);

  // Invalidate the query whenever the event stream delivers something new
  useEffect(() => {
    const latest = events[0];
    if (latest?.name === 'deal-event-processed') {
      // Small debounce — let the backend finish processing before we re-fetch
      const timer = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: DEALS_QUERY_KEY });
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [events, queryClient]);

  return useQuery<DealsPage>({
    queryKey: [...DEALS_QUERY_KEY, page, limit],
    queryFn: () => fetchDeals(page, limit, 3),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}
