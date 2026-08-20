'use client';
// TanStack Query provider — one client per mount, held in a ref.
// A module-scope client would be shared across SSR requests and leak one user's
// cache into another's response.
// SOT: docs/pack/11-architectural-guardrails.md §2 (client cache layer)
// SOT-KEYWORDS: query provider tanstack cache client ssr react-query
import { useRef, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * §4 data layer defaults — one QueryClient per app, composed in each app's
 * providers. Server state lives HERE, never in Zustand.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,          // sensible default for slowly-changing data
        gcTime: 30 * 60_000,
        retry: 2,
        refetchOnWindowFocus: false, // deliberate refresh via invalidation
      },
      mutations: { retry: 0 },       // mutations surface errors, never silently retry
    },
  });
}

export function AppQueryProvider({ children }: { children: ReactNode }) {
  // Stable per-tree instance via ref (repo rule: no React useState).
  const ref = useRef<QueryClient | null>(null);
  ref.current ??= createQueryClient();
  return <QueryClientProvider client={ref.current}>{children}</QueryClientProvider>;
}
