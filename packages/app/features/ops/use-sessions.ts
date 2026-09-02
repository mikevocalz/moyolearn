'use client';
// Today's sessions for the ops hero, read from `GET /api/ops/sessions` — the
// use-leads model at its smallest: exported key factory, server data in Query
// only, the tenant and the day window decided behind `protectedOperation` and
// never re-derived here. The rows arrive as the display VIEW ("09:00–09:45",
// names, 'Virtual') because the repository owns the translation; this hook
// carries strings to a screen and knows nothing about the collection.
// SOT: docs/decisions/adr-110-sessions-object.md · apps/web/app/api/ops/sessions/route.ts · packages/app/features/ops/use-leads.ts
// SOT-KEYWORDS: ops sessions hook tanstack query today hero schedule calendar
import { useQuery } from '@tanstack/react-query';
import type { Session } from './ops.data.ts';
import { API_URL } from '../../core/api-url.ts';

/** Key factory — inline queryKey arrays are a lint error (doc 11 §4). */
export const sessionsQueryKey = () => ['ops', 'sessions'] as const;

export interface SessionsRead {
  sessions: readonly Session[];
  loading: boolean;
  error: Error | null;
}

export function useSessions(): SessionsRead {
  const { data, isPending, error } = useQuery({
    queryKey: sessionsQueryKey(),
    queryFn: async ({ signal }): Promise<readonly Session[]> => {
      const res = await fetch(`${API_URL}/api/ops/sessions`, {
        credentials: 'include',
        signal,
      });
      if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
      const body = (await res.json()) as { sessions: readonly Session[] };
      return body.sessions;
    },
  });

  return { sessions: data ?? [], loading: isPending, error: error ?? null };
}
