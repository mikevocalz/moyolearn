'use client';
// The org triage queue, read from `GET /api/safety/incidents`.
//
// ONE ROUTE, NO NEW ONE. The web route already returns exactly `TriageQueue`
// (`{ ok, rows, unassignedS4 }`) behind `incidentTriageQueue`, which sets its
// own `requiresMembership: ['owner','manager']` so no caller can lower the wall.
// A mobile-shaped endpoint would have been a second door onto the same table
// with its own copy of that gate.
//
// READ-ONLY, deliberately. The route's PATCH takes an `assigneeId`, which is a
// resource ("who is on this"), not the caller — so a phone offering "assign to
// me" would have to send the acting user's own id up from the client, and
// identity is never client input (CLAUDE.md §The block). Triage moves stay on
// the web ops surface where the assignee is picked from a roster.
// SOT: apps/web/app/api/safety/incidents/route.ts · docs/pack/31-grade-voice-safety-incidents.md §5.3
// SOT-KEYWORDS: safety incident queue hook tanstack query triage org mobile read only sla

import { useQuery } from '@tanstack/react-query';
import type { TriageQueue } from './incidents.service.ts';

const API_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.EXPO_PUBLIC_APP_URL ??
  'http://localhost:3001';

/** Key factory — inline queryKey arrays are a lint error (doc 11 §4). */
export const incidentQueueKey = () => ['safety', 'incident-queue'] as const;

const EMPTY: TriageQueue = { rows: [], unassignedS4: 0 };

export interface IncidentQueueRead {
  queue: TriageQueue;
  loading: boolean;
  error: Error | null;
  /**
   * The role wall, told apart from a broken network. The route flattens both of
   * its refusals to 403 on purpose — "an incident queue is never an upsell
   * surface, so a 402 has no business leaving it" — so a phone that showed
   * "something went wrong" here would be hiding a real, correct answer.
   */
  denied: boolean;
}

class QueueDenied extends Error {}

export function useIncidentQueue(): IncidentQueueRead {
  const { data, isPending, error } = useQuery({
    queryKey: incidentQueueKey(),
    queryFn: async ({ signal }): Promise<TriageQueue> => {
      const response = await fetch(`${API_URL}/api/safety/incidents`, {
        credentials: 'include',
        signal,
      });
      if (response.status === 403) throw new QueueDenied('Not your queue');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = (await response.json()) as TriageQueue;
      return { rows: body.rows, unassignedS4: body.unassignedS4 };
    },
    /*
      No polling. Every row carries an SLA countdown, which tempts a refresh
      loop — but the queue is worked by a person who is looking at it, and
      Query's refetch-on-focus already covers "I came back to this screen".
      A timer would spend a staff phone's battery redrawing a clock nobody is
      reading.
    */
    retry: (failureCount, cause) => !(cause instanceof QueueDenied) && failureCount < 2,
  });

  return {
    queue: data ?? EMPTY,
    loading: isPending,
    error: error instanceof QueueDenied ? null : (error ?? null),
    denied: error instanceof QueueDenied,
  };
}
