'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Don't retry on 4xx client errors — only transient network / 5xx
        retry: (failureCount, error) => {
          if (error instanceof Error && /^API 4\d{2}/.test(error.message)) {
            return false;
          }
          return failureCount < 2;
        },
        retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 15_000),
        // Serve stale data while revalidating silently
        staleTime: 10_000,
        // Keep unused query cache for 5 minutes
        gcTime: 5 * 60 * 1_000,
        // SSE handles freshness — no need to re-fetch on window focus
        refetchOnWindowFocus: false,
      },
    },
  });
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // useState with an initialiser ensures a single QueryClient per component
  // tree, even in React StrictMode / concurrent rendering
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
