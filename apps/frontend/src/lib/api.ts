/**
 * Typed API client for Deal Radar backend.
 * All fetch calls go through here so the base URL is managed in one place.
 */

import type {
  DealListItemResponse,
  PaginationMeta,
} from '@deal-radar/shared-types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type DealsPage = {
  data: DealListItemResponse[];
  pagination: PaginationMeta;
};

export async function fetchDeals(
  page = 1,
  limit = 20,
  activityLimit = 3,
): Promise<DealsPage> {
  const url = `${API_BASE}/api/deals?page=${page}&limit=${limit}&activityLimit=${activityLimit}`;
  const res = await fetch(url, { next: { revalidate: 0 } });

  if (!res.ok) {
    throw new Error(`Failed to fetch deals: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<DealsPage>;
}
