'use client';
// useGuardianReports / useGuardianReport / useSummaryQueue — the client read
// models for doc 34 §5's three surfaces, on TanStack Query with exported key
// factories so the write paths (share, approve, suppress) invalidate exactly
// the surface they changed. Same discipline `use-progress.ts` records: server
// data lives in Query, never in component state.
// SOT: docs/pack/34-session-summary-reports.md §5 · packages/app/features/progress/use-progress.ts
// SOT-KEYWORDS: reports hooks client query guardian feed report detail queue drafts keys invalidate
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  GuardianSummaryCard,
  GuardianSummaryView,
  SummaryQueueRow,
  TeacherShareGrant,
} from './summary.service.ts';
import { API_URL } from '../../core/api-url.ts';
import { getJson, isNotFound } from '../../core/api-fetch.ts';

export const reportsQueryKey = () => ['guardian-reports'] as const;
export const reportQueryKey = (sessionId: string) => ['guardian-reports', sessionId] as const;
export const summaryQueueQueryKey = () => ['summary-queue'] as const;

/**
 * The family feed read. `retry` is part of the contract, not a convenience:
 * this list's consumer used to destructure `{reports, loading}` and drop the
 * error, so a failed read fell through to `reports.length === 0` and drew the
 * calm "No reports yet" state — telling a parent their child has had no
 * sessions because we could not reach the server. An error a screen cannot see
 * is an error a screen will render as good news, so the failure and its way out
 * both leave this hook.
 *
 * `keepPreviousData` means a refetch that fails still holds the last good list;
 * that is the contract's offline path (cached reports stay readable) and it is
 * why the consumer must decide between "stale, labelled" and "nothing to show".
 */
export function useGuardianReports() {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: reportsQueryKey(),
    queryFn: async ({ signal }) =>
      (await getJson<{ reports: GuardianSummaryCard[] }>('/api/guardian/reports', signal)).reports,
    placeholderData: keepPreviousData,
  });
  return {
    reports: data ?? [],
    loading: isPending,
    error: error ?? null,
    retry: () => {
      void refetch();
    },
  };
}

/**
 * One report. `notFound` is told apart from `error` on purpose: a 404 is the
 * silent-drop wall a stale or foreign link must hit ("Report not available"),
 * while a 401/500 owes an honest failure and a retry. Both used to arrive as
 * `report === null`, so a broken read wore the not-found sentence and the
 * reader was told their report was gone.
 */
export function useGuardianReport(sessionId: string) {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: reportQueryKey(sessionId),
    queryFn: async ({ signal }) =>
      (
        await getJson<{ report: GuardianSummaryView }>(
          `/api/guardian/reports/${encodeURIComponent(sessionId)}`,
          signal,
        )
      ).report,
  });
  return {
    report: data ?? null,
    loading: isPending,
    notFound: isNotFound(error),
    error: isNotFound(error) ? null : (error ?? null),
    retry: () => {
      void refetch();
    },
  };
}

/**
 * The share pair. The mutation's own `data` holds the grant — the raw link
 * exists in the response and nowhere else, so there is deliberately no cache
 * entry to read it back out of later.
 */
export function useTeacherShare(sessionId: string) {
  const client = useQueryClient();
  const share = useMutation({
    mutationFn: async (): Promise<TeacherShareGrant> => {
      const res = await fetch(
        `${API_URL}/api/guardian/reports/${encodeURIComponent(sessionId)}/share`,
        { method: 'POST', credentials: 'include' },
      );
      if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
      return ((await res.json()) as { share: TeacherShareGrant }).share;
    },
  });
  const revoke = useMutation({
    mutationFn: async (): Promise<void> => {
      const res = await fetch(
        `${API_URL}/api/guardian/reports/${encodeURIComponent(sessionId)}/share`,
        { method: 'DELETE', credentials: 'include' },
      );
      if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
    },
    onSuccess: () => {
      share.reset();
      void client.invalidateQueries({ queryKey: reportQueryKey(sessionId) });
    },
  });
  return { share, revoke };
}

export function useSummaryQueue() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: summaryQueueQueryKey(),
    queryFn: async ({ signal }) =>
      (await getJson<{ rows: SummaryQueueRow[] }>('/api/summary/queue', signal)).rows,
    placeholderData: keepPreviousData,
  });

  const act = useMutation({
    mutationFn: async (input: {
      action: 'approve' | 'suppress';
      sessionId: string;
      reason?: string;
    }): Promise<void> => {
      const res = await fetch(`${API_URL}/api/summary/queue`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: summaryQueueQueryKey() });
    },
  });

  // Inline-retry callable (the use-tutor-incidents idiom): the queue's error
  // state retries the same read in place, never a page reload.
  return {
    rows: query.data ?? [],
    loading: query.isPending,
    error: query.error,
    act,
    retry: () => {
      void query.refetch();
    },
  };
}
