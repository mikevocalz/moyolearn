'use client';
// Today's sessions for the ops hero, read from `GET /api/ops/sessions` — the
// use-leads model at its smallest: exported key factory, server data in Query
// only, the tenant and the day window decided behind `protectedOperation` and
// never re-derived here. The rows arrive as the display VIEW ("09:00–09:45",
// names, 'Virtual') because the repository owns the translation; this hook
// carries strings to a screen and knows nothing about the collection.
// SOT: docs/decisions/adr-110-sessions-object.md · apps/web/app/api/ops/sessions/route.ts · packages/app/core/api-fetch.ts
// SOT-KEYWORDS: ops sessions hook tanstack query today hero schedule calendar api error retry
import { useQuery } from '@tanstack/react-query';
import type { Session } from './ops.data.ts';
import { getJson } from '../../core/api-fetch.ts';

/** Key factory — inline queryKey arrays are a lint error (doc 11 §4). */
export const sessionsQueryKey = () => ['ops', 'sessions'] as const;

export interface SessionsRead {
  sessions: readonly Session[];
  loading: boolean;
  error: Error | null;
  /**
   * Handed back so the hero's failed-read banner can carry the retry its copy
   * promises. "Try again in a moment" with no way to try again is an
   * instruction the screen refuses to take itself (the families-content
   * precedent), and a reload is not the same offer — it costs the whole page.
   */
  retry: () => void;
}

export function useSessions(): SessionsRead {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: sessionsQueryKey(),
    /*
      `getJson`, not a hand-rolled fetch throwing `new Error('HTTP 401')`. The
      status has to survive as DATA: the QueryClient's retry predicate reads it
      to stop backing off on a settled refusal (a 401 held this read in
      `pending` — i.e. skeletons — for the whole backoff before the hero's
      error branch could run), and the screen reads it to tell "signed out"
      apart from "connection down", which have different ways out.
    */
    queryFn: async ({ signal }): Promise<readonly Session[]> =>
      (await getJson<{ sessions: readonly Session[] }>('/api/ops/sessions', signal)).sessions,
  });

  return {
    sessions: data ?? [],
    loading: isPending,
    error: error ?? null,
    retry: () => {
      void refetch();
    },
  };
}
