'use client';
// useHomeworkTimeline — GET /api/homework/submissions?learner=<authId>, one
// learner's dated homework list, newest first (contract §Routes). The server
// enforces that the learner is one of the caller's active wards or the caller
// themself; the client only names who it is asking about.
//
// Keyed per learner so switching children swaps cache entries instead of
// refetching into one shared slot, and so B2's write paths (create, advance)
// can invalidate the one child they changed. Disabled without a learner: an
// empty switcher must not fire a request for `learner=` and then render its
// 400 as "no homework yet".
// SOT: docs/work/pr-100/contract.md §Routes · packages/app/features/summary/use-reports.ts
// SOT-KEYWORDS: homework timeline hook query submissions learner guardian dated list

import { queryOptions, useQuery } from '@tanstack/react-query';
import { getJson } from '../../core/api-fetch.ts';
import type { HomeworkSubmissionSummary } from './homework.types.ts';

export const homeworkTimelineQueryKey = (learnerAuthId: string) =>
  ['homework-timeline', learnerAuthId] as const;

export function homeworkTimelineOptions(learnerAuthId: string | undefined) {
  const learner = learnerAuthId ?? '';
  return queryOptions({
    queryKey: homeworkTimelineQueryKey(learner),
    enabled: learner.length > 0,
    queryFn: async ({ signal }) => {
      const body = await getJson<
        HomeworkSubmissionSummary[] | { submissions: HomeworkSubmissionSummary[] }
      >(`/api/homework/submissions?learner=${encodeURIComponent(learner)}`, signal);
      // Bare array per the contract; a `{ submissions }` envelope tolerated for
      // the same reason as in use-guardian-wards.ts.
      return Array.isArray(body) ? body : body.submissions;
    },
    // A different query key means a different child, not another page of the
    // same feed. Keep that child's loading state instead of showing a sibling.
  });
}

export function useHomeworkTimeline(learnerAuthId: string | undefined) {
  const { data, isPending, error, refetch } = useQuery(homeworkTimelineOptions(learnerAuthId));
  return {
    submissions: data ?? [],
    /** Pending only while enabled; a disabled query is "nothing to load". */
    loading: Boolean(learnerAuthId) && isPending,
    error: error ?? null,
    retry: () => {
      void refetch();
    },
  };
}
