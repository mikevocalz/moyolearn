'use client';
// The guardian's incident read + acknowledgment write, over
// `GET/POST /api/guardian/incidents`, on the use-tutor-incidents model:
// exported key factory, server data in Query only, the scoping (ACTIVE
// guardianships → wards) decided behind `protectedOperation` and never
// re-derived here.
//
// The ack posts `{incidentId}` and NOTHING else — the acknowledging identity
// comes from `ctx` and the clock from the server (CLAUDE.md §The block). No
// optimistic update on purpose: `guardianAcknowledged` is a line in an
// append-only safety timeline, and showing it before the door accepted the
// write is the contract's "never silently" failure. The route answers the
// POST with the updated view, so success settles the cache from the server's
// own words rather than a guess.
// SOT: apps/web/app/api/guardian/incidents/route.ts · design/screens/guardian/guardian.alerts/contract.md
// SOT-KEYWORDS: guardian incidents hook tanstack query acknowledge alerts wards

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GuardianIncidentView } from './incidents.service.ts';
import { API_URL } from '../../core/api-url.ts';

/** Key factory — inline queryKey arrays are a lint error (doc 11 §4). */
export const guardianIncidentsKey = () => ['safety', 'guardian-incidents'] as const;

export interface GuardianIncidentsRead {
  incidents: readonly GuardianIncidentView[];
  loading: boolean;
  error: Error | null;
  /** The contract's offline path made callable: cached list stays, retry is explicit. */
  retry: () => void;
}

export function useGuardianIncidents(): GuardianIncidentsRead {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: guardianIncidentsKey(),
    queryFn: async ({ signal }): Promise<readonly GuardianIncidentView[]> => {
      const response = await fetch(`${API_URL}/api/guardian/incidents`, {
        credentials: 'include',
        signal,
      });
      if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
      const body = (await response.json()) as { incidents: readonly GuardianIncidentView[] };
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

export function useAcknowledgeIncident() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { incidentId: string }): Promise<GuardianIncidentView> => {
      const response = await fetch(`${API_URL}/api/guardian/incidents`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
      const body = (await response.json()) as { incident: GuardianIncidentView };
      return body.incident;
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: guardianIncidentsKey() });
    },
  });
}
