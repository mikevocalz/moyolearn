'use client';
// useLearnerAssignments / useMarkAssignmentDone — the client models for the J1
// arrival signal, on the use-reports.ts pattern: exported key factory,
// exact-key invalidation, server data in Query only. The one mutation is the
// learner's self-report — "mark done" — which never edits the assignment
// itself; the server is idempotent about it, so a retry of a tap that already
// landed simply returns the same done state.
//
// `enabled` exists because the caller decides BY BAND whether this read runs
// at all: K–2 and 3–5 surfaces never fetch due work (learner.home contract's
// band variants), and a hook that fetched anyway would be the due-work strip
// arriving through the network tab.
// SOT: design/screens/learner/learner.plan/contract.md · packages/app/features/summary/use-reports.ts
// SOT-KEYWORDS: learner assignments hook client query arrival due work published keys enabled band mark done mutation
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LearnerAssignment } from './learner-assignments.service.ts';
import { assignmentQueryKey, teacherAssignmentsQueryKey } from './use-assignments.ts';
import { API_URL } from '../../core/api-url.ts';
import { getJson } from '../../core/api-fetch.ts';

export const learnerAssignmentsQueryKey = () => ['learner-assignments'] as const;

/**
 * `retry` leaves the hook because the plan owes one. A failed read here used to
 * arrive as an empty assignment list and merge into the fixture week as nothing
 * at all — so "we could not reach the server" rendered as "Nothing due — nice."
 * to a child who did in fact have homework. The error and the way out of it are
 * both part of what this hook returns, on the use-reports pattern.
 *
 * `keepPreviousData` means a refetch that fails still holds the last good list:
 * that is the contract's offline path (cached week stays readable), and it is
 * the consumer's job to label it stale rather than pretend it is fresh.
 */
export function useLearnerAssignments(enabled = true) {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: learnerAssignmentsQueryKey(),
    queryFn: async ({ signal }) =>
      (await getJson<{ assignments: LearnerAssignment[] }>('/api/learner/assignments', signal))
        .assignments,
    placeholderData: keepPreviousData,
    enabled,
  });
  return {
    assignments: data ?? [],
    loading: isPending,
    error: error ?? null,
    retry: () => {
      void refetch();
    },
  };
}

/**
 * The self-report: POSTs "done" for one of the learner's own assignments.
 * Exact-key invalidation over the single learner list — home's due strip and
 * the plan both read it, so one refetch settles every surface. The teacher
 * keys are invalidated too: mark-done moves the "X of Y done" counts the
 * tracking list and detail render, and a household where teacher and learner
 * share a device (or a query cache via the same web session) would otherwise
 * show the teacher a stale count until an unrelated write happened to refresh
 * it. The key factories come from use-assignments so the two sides can never
 * drift apart on key shape.
 */
export function useMarkAssignmentDone() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (assignmentId: string): Promise<LearnerAssignment> => {
      const res = await fetch(
        `${API_URL}/api/learner/assignments/${encodeURIComponent(assignmentId)}/done`,
        { method: 'POST', credentials: 'include' },
      );
      if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
      return ((await res.json()) as { assignment: LearnerAssignment }).assignment;
    },
    onSuccess: (_assignment, assignmentId) => {
      void client.invalidateQueries({ queryKey: learnerAssignmentsQueryKey() });
      // Prefix invalidation covers the unfiltered list and every per-class
      // filter (the use-assignments discipline); the detail key is exact.
      void client.invalidateQueries({ queryKey: teacherAssignmentsQueryKey() });
      void client.invalidateQueries({ queryKey: assignmentQueryKey(assignmentId) });
    },
  });
}
