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
//
// The intake pair lives here too: the engaged-learner read that feeds the
// subject picker (names only — the projection is the server's), and the
// submit mutation, which posts to the `./report` subroute and carries no
// severity and no reporter role — both are the server's to decide. Same
// no-optimistic-update rule, sharpened: a safety report shown as filed before
// the door accepted it is the "silently lost" failure the contract bans.
// SOT: apps/web/app/api/tutor/incidents/route.ts · packages/app/features/safety/use-incident-queue.ts
// SOT-KEYWORDS: tutor incidents hook tanstack query filed lifecycle append note reporter intake submit engaged learners subject

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EngagedLearner, TutorIncidentView } from './incidents.service.ts';
import { API_URL } from '../../core/api-url.ts';

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

/** Key factory for the intake's subject picker read. */
export const engagedLearnersKey = () => ['safety', 'tutor-engaged-learners'] as const;

export interface EngagedLearnersRead {
  learners: readonly EngagedLearner[];
  loading: boolean;
  error: Error | null;
}

/** The acting tutor's engaged learners — ADR-108's roster edge, names only. */
export function useEngagedLearners(): EngagedLearnersRead {
  const { data, isPending, error } = useQuery({
    queryKey: engagedLearnersKey(),
    queryFn: async ({ signal }): Promise<readonly EngagedLearner[]> => {
      const response = await fetch(`${API_URL}/api/tutor/engagements`, {
        credentials: 'include',
        signal,
      });
      if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
      const body = (await response.json()) as { learners: readonly EngagedLearner[] };
      return body.learners;
    },
  });

  return { learners: data ?? [], loading: isPending, error: error ?? null };
}

/**
 * What the intake form posts. No severity, no reporter role — the first is
 * triage's judgment (doc 31 §5.1), the second is a fact of the door.
 */
export interface SubmitTutorIncidentBody {
  subjectLearnerId: string;
  category: TutorIncidentView['category'];
  occurredAt: string;
  summary: string;
  immediateActionTaken: string | null;
  anonymous: boolean;
}

export function useSubmitTutorIncident() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: SubmitTutorIncidentBody): Promise<{ incidentId: string }> => {
      const response = await fetch(`${API_URL}/api/tutor/incidents/report`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
      return (await response.json()) as { incidentId: string };
    },
    onSuccess: () => {
      // The contract's "submit returns to the list with the new incident
      // visible" — unless the filing was anonymous, in which case its absence
      // is the promise working (the form warned before the box was ticked).
      void client.invalidateQueries({ queryKey: tutorIncidentsKey() });
    },
  });
}
