/**
 * Typed API client for the Deal Radar backend.
 *
 * All fetch calls go through here so:
 *  - The base URL is managed in one place
 *  - Errors carry the HTTP status + any body detail
 *  - A per-request timeout prevents indefinite hangs
 */

import type { DealListItemResponse, PaginationMeta } from '@deal-radar/shared-types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Abort a request after this many milliseconds */
const REQUEST_TIMEOUT_MS = 15_000;

export type DealsPage = {
  data: DealListItemResponse[];
  pagination: PaginationMeta;
};

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------

async function apiFetch<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      signal: controller.signal,
      // Opt out of Next.js data cache — TanStack Query owns caching here
      cache: 'no-store',
    });

    if (!res.ok) {
      // Surface the error body when available for better DX
      let detail = '';
      try {
        const body = (await res.json()) as { error?: { message?: string } };
        detail = body?.error?.message ? `: ${body.error.message}` : '';
      } catch {
        // ignore JSON parse failures
      }
      throw new Error(`API ${res.status} ${res.statusText}${detail}`);
    }

    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export async function fetchDeals(
  page = 1,
  limit = 20,
  activityLimit = 3,
): Promise<DealsPage> {
  return apiFetch<DealsPage>(
    `/api/deals?page=${page}&limit=${limit}&activityLimit=${activityLimit}`,
  );
}
