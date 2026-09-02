'use client';
// The org triage queue, read from `GET /api/safety/incidents` — and, on the web
// surface only, moved through its PATCH.
//
// ONE ROUTE, NO NEW ONE. The web route already returns exactly `TriageQueue`
// (`{ ok, rows, unassignedS4 }`) behind `incidentTriageQueue`, which sets its
// own `requiresMembership: ['owner','manager']` so no caller can lower the wall.
// A mobile-shaped endpoint would have been a second door onto the same table
// with its own copy of that gate.
//
// THE READ IS SHARED; THE WRITE IS THE WEB VIEW'S. Mobile stays read-only
// (`incident-queue-content.tsx` records why), and org.safety's contract puts
// triage on the web rail view — `useTriageIncident` below is that view's
// mutation. It posts only what the PATCH validates (`incidentId` plus the
// lifecycle fields) and NEVER the actor: identity is not client input
// (CLAUDE.md §The block), the audit line's actor comes from `ctx` server-side.
//
// NO OPTIMISTIC UPDATE, deliberately — the same rule as the tutor note append:
// a triage move is an audit-trail write, and a row shown moved before the
// server accepted it is a record the trail might not hold. The contract's
// `triage_write_failed` path ("rolls back visibly with retry") is therefore
// trivially true: nothing renders moved until it IS moved, and a failure
// surfaces beside the control with the input intact.
// SOT: apps/web/app/api/safety/incidents/route.ts · design/screens/org/org.safety/contract.md · docs/pack/31-grade-voice-safety-incidents.md §5.3
// SOT-KEYWORDS: safety incident queue hook tanstack query triage org mobile web mutation patch lifecycle sla

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TriageQueue, TriageRow } from './incidents.service.ts';

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

/**
 * One lifecycle move, as the PATCH accepts it. `assigneeId` is deliberately
 * absent: no staff-roster read exists to pick a person from, and posting the
 * caller's own id would make identity client input — the deferral is recorded
 * in `org-safety-content.tsx`'s header. `resolution` travels with the closing
 * moves because the guardian's "What happens next" reads it (doc 31 §5.2).
 */
export interface TriageMove {
  incidentId: string;
  status?: TriageRow['status'];
  severity?: TriageRow['severity'];
  resolution?: string;
}

export function useTriageIncident() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (move: TriageMove): Promise<TriageRow> => {
      const response = await fetch(`${API_URL}/api/safety/incidents`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(move),
      });
      if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
      const body = (await response.json()) as { incident: TriageRow };
      return body.incident;
    },
    onSuccess: () => {
      /*
        Exact, because the `['safety', …]` prefix is shared: a fuzzy match
        would also refetch the tutor filed-incident list on every queue move,
        and that list belongs to a different role's session entirely.
      */
      void client.invalidateQueries({ queryKey: incidentQueueKey(), exact: true });
    },
  });
}
