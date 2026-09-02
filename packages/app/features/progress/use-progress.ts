'use client';
// useProgress — client hook for the persisted learner student model snapshot.
// SOT: docs/pack/22-reporting-charts-spec.md §2
// SOT-KEYWORDS: progress mastery hook client fetch review scaffolding query
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { API_URL } from '../../core/api-url.ts';

export interface ProgressData {
  masteryBySkill: Record<string, number>;
  reviewBySkill: Record<string, string>;
  scaffoldingBySkill: Record<string, number>;
}

const EMPTY: ProgressData = {
  masteryBySkill: {},
  reviewBySkill: {},
  scaffoldingBySkill: {},
};

/** Exported so a write path can invalidate exactly this surface. */
export const progressQueryKey = (revision: number) => ['progress', revision] as const;

/**
 * This was a hand-rolled fetch inside useEffect writing to three useState
 * slots, which is the shape the repo bans twice over: server data does not live
 * in component state (Query owns it), and the synchronous setState in the
 * effect made React re-render the whole ProgressScreen an extra time per load.
 *
 * `revision` stays in the query key rather than becoming an imperative refetch:
 * bumping it is a new key, so Query fetches, caches and dedupes it like any
 * other — and `keepPreviousData` means the mastery bars hold their last value
 * through the refresh instead of collapsing to zero, which on a progress screen
 * reads as "you lost your progress".
 */
export function useProgress(revision = 0) {
  const { data, isPending, error } = useQuery({
    queryKey: progressQueryKey(revision),
    queryFn: async ({ signal }): Promise<ProgressData> => {
      const res = await fetch(`${API_URL}/api/progress`, {
        credentials: 'include',
        signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as ProgressData;
    },
    placeholderData: keepPreviousData,
  });

  return { ...(data ?? EMPTY), loading: isPending, error };
}
