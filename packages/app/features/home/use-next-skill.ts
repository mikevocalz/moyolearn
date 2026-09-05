'use client';
// useNextSkill — what the learner's home says the child is working on.
//
// Reads the same adaptive picker the tutor session uses (`/api/tutor/next`),
// on the use-learner-assignments pattern: exported key factory, server data in
// Query only, and `retry` returned because the surface owes the child a way out
// of a failed read rather than a hero that quietly says nothing.
//
// `source` is the reason this is a hook and not a one-line fetch. The picker
// falls back to a seeded skill for a learner with no facts, which is correct
// inside a session and would be a fabricated claim on a home hero — "here is
// what you are working on" about a child who has not worked on anything. The
// hook surfaces the discriminant so the hero can render an invitation instead
// of an invented history, and `derived` is the one boolean every caller
// actually branches on.
//
// SOT: apps/web/app/api/tutor/next/route.ts · packages/student-model/src/skills.ts ·
//      design/screens/learner/learner.home/contract.md
// SOT-KEYWORDS: next skill home hero learner adaptive review mastery seed derived query
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { NextProblem } from '@acme/student-model/pure';
import { getJson } from '../../core/api-fetch.ts';

export const nextSkillQueryKey = () => ['next-skill'] as const;

export interface NextSkillRead {
  /** The skill the picker chose, or undefined while loading or after a failure. */
  skill: NextProblem | undefined;
  /**
   * True when the skill came off the learner's own facts. False for a seeded
   * pick, which a surface must not describe as the child's own work.
   */
  derived: boolean;
  loading: boolean;
  error: Error | null;
  retry: () => void;
}

export function useNextSkill(enabled = true): NextSkillRead {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: nextSkillQueryKey(),
    queryFn: ({ signal }) => getJson<NextProblem>('/api/tutor/next', signal),
    placeholderData: keepPreviousData,
    enabled,
  });

  return {
    skill: data,
    derived: data ? data.source !== 'seed' : false,
    loading: enabled && isPending,
    error: error as Error | null,
    retry: () => {
      void refetch();
    },
  };
}
