'use client';
// The tutor's filed-incident list, read from `GET /api/tutor/incidents`, on
// the use-incident-queue model: exported key factory, server data in Query
// only, the scoping decided behind `protectedOperation` and never re-derived
// here.
//
// The append mutation posts `{incidentId, note}` and NOTHING identifying —
// the actor comes from `ctx` on the server (CLAUDE.md §The block). No
// optimistic update on purpose: the timeline is an audit trail, and a line
// shown before the append-only door accepted it would be a line the record
// might not hold. On failure the composer's text survives in the screen's own
// state, so the retry is the same note, not a retyped one.
// SOT: apps/web/app/api/tutor/incidents/route.ts · packages/app/features/safety/use-incident-queue.ts
// SOT-KEYWORDS: tutor incidents hook tanstack query filed lifecycle append note reporter

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TutorIncidentView } from './incidents.service.ts';

const API_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.EXPO_PUBLIC_APP_URL ??
  'http://localhost:3001';

/** Key factory — inline queryKey arrays are a lint error (doc 11 §4). */
export const tutorIncidentsKey = () => ['safety', 'tutor-incidents'] as const;

export interface TutorIncidentsRead {
  incidents: readonly TutorIncidentView[];
  loading: boolean;
  error: Error | null;
  /** The contract's `queue_fetch_failed: inline retry`, as a callable. */
  retry: () => void;
}

export function useTutorIncidents(): TutorIncidentsRead {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: tutorIncidentsKey(),
    queryFn: async ({ signal }): Promise<readonly TutorIncidentView[]> => {
      const response = await fetch(`${API_URL}/api/tutor/incidents`, {
        credentials: 'include',
        signal,
      });
      if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
      const body = (await response.json()) as { incidents: readonly TutorIncidentView[] };
      return body.incidents;
    },
  });

  return {
    incidents: data ?? [],
    loading: isPending,
    error: error ?? null,
    retry: () => {
      void refetch();
    },
  };
}

export function useAppendIncidentNote() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { incidentId: string; note: string }): Promise<TutorIncidentView> => {
      const response = await fetch(`${API_URL}/api/tutor/incidents`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
      const body = (await response.json()) as { incident: TutorIncidentView };
      return body.incident;
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: tutorIncidentsKey() });
    },
  });
}
