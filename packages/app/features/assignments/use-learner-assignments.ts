'use client';
// useLearnerAssignments — the client read model for the J1 arrival signal, on
// the use-reports.ts pattern: exported key factory, server data in Query only.
// There is no mutation half — the learner never writes an assignment; item
// completion travels through the tutor session loop, not this surface.
//
// `enabled` exists because the caller decides BY BAND whether this read runs
// at all: K–2 and 3–5 surfaces never fetch due work (learner.home contract's
// band variants), and a hook that fetched anyway would be the due-work strip
// arriving through the network tab.
// SOT: design/screens/learner/learner.plan/contract.md · packages/app/features/summary/use-reports.ts
// SOT-KEYWORDS: learner assignments hook client query arrival due work published keys enabled band
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { LearnerAssignment } from './learner-assignments.service.ts';

const API_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? process.env.EXPO_PUBLIC_APP_URL ?? 'http://localhost:3001';

export const learnerAssignmentsQueryKey = () => ['learner-assignments'] as const;

async function getJson<T>(path: string, signal: AbortSignal | undefined): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { credentials: 'include', signal });
  if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
  return (await res.json()) as T;
}

export function useLearnerAssignments(enabled = true) {
  const { data, isPending, error } = useQuery({
    queryKey: learnerAssignmentsQueryKey(),
    queryFn: async ({ signal }) =>
      (await getJson<{ assignments: LearnerAssignment[] }>('/api/learner/assignments', signal))
        .assignments,
    placeholderData: keepPreviousData,
    enabled,
  });
  return { assignments: data ?? [], loading: isPending, error };
}
