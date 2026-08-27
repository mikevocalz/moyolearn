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

const API_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? process.env.EXPO_PUBLIC_APP_URL ?? 'http://localhost:3001';

export const reportsQueryKey = () => ['guardian-reports'] as const;
export const reportQueryKey = (sessionId: string) => ['guardian-reports', sessionId] as const;
export const summaryQueueQueryKey = () => ['summary-queue'] as const;

async function getJson<T>(path: string, signal: AbortSignal | undefined): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { credentials: 'include', signal });
  if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
  return (await res.json()) as T;
}

export function useGuardianReports() {
  const { data, isPending, error } = useQuery({
    queryKey: reportsQueryKey(),
    queryFn: async ({ signal }) =>
      (await getJson<{ reports: GuardianSummaryCard[] }>('/api/guardian/reports', signal)).reports,
    placeholderData: keepPreviousData,
  });
  return { reports: data ?? [], loading: isPending, error };
}

export function useGuardianReport(sessionId: string) {
  const { data, isPending, error } = useQuery({
    queryKey: reportQueryKey(sessionId),
    queryFn: async ({ signal }) =>
      (
        await getJson<{ report: GuardianSummaryView }>(
          `/api/guardian/reports/${encodeURIComponent(sessionId)}`,
          signal,
        )
      ).report,
  });
  return { report: data ?? null, loading: isPending, error };
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

  return { rows: query.data ?? [], loading: query.isPending, error: query.error, act };
}
