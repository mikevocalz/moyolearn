'use client';
// useGuardianWards — the client read of GET /api/guardian/wards, the list the
// child switcher is fed from. The server derives it from ACTIVE guardianships
// for `ctx.learnerId` (contract §Routes, `loadGuardianWards`), so the client
// never names a child it was not told about, and a revoked guardianship drops
// the child on the next refetch rather than lingering in a device store.
//
// Same TanStack Query discipline as ../summary/use-reports.ts: the key is
// exported so a write path (a new guardianship, an erasure) can invalidate
// exactly this read, `retry` leaves the hook so a screen can offer a way out,
// and `keepPreviousData` keeps the last good list through a failed refetch.
//
// `gradeBand` arrives as a string because B1 owns the handler and the contract
// does not pin the register. Both spellings the repo stores are accepted: the
// doc 31 voice band (`k-2`…`9-12`) and the doc 08 presentation band
// (`young`…`adult`). Anything else falls to the presentation default via
// `asAgeBand`, exactly as every other band read in the app does.
// SOT: docs/work/pr-100/contract.md §Routes · packages/app/features/summary/use-reports.ts · packages/app/features/family/family.store.ts
// SOT-KEYWORDS: guardian wards hook query children switcher active guardianship grade band

import { useEffect } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getJson } from '../../core/api-fetch.ts';
import { ageBandForVoiceBand, asAgeBand } from '../capture/age-band.ts';
import { useFamilyStore, type ChildSummary } from '../family/family.store.ts';

export const guardianWardsQueryKey = () => ['guardian-wards'] as const;

/** The wire shape, as contract §Routes states it. */
export interface GuardianWardRow {
  readonly learnerAuthId: string;
  readonly displayName: string;
  readonly gradeBand: string;
}

/** One ward row as the family store holds it. */
export function wardToChild(ward: GuardianWardRow): ChildSummary {
  return {
    id: ward.learnerAuthId,
    name: ward.displayName,
    gradeBand: ageBandForVoiceBand(ward.gradeBand) ?? asAgeBand(ward.gradeBand),
  };
}

export function useGuardianWards() {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: guardianWardsQueryKey(),
    queryFn: async ({ signal }) => {
      const body = await getJson<GuardianWardRow[] | { wards: GuardianWardRow[] }>(
        '/api/guardian/wards',
        signal,
      );
      // The contract writes a bare array. A `{ wards }` envelope is tolerated
      // so a handler that mirrors `/api/guardian/reports` does not empty the
      // switcher; both shapes land as the same list.
      const rows = Array.isArray(body) ? body : body.wards;
      return rows.map(wardToChild);
    },
    placeholderData: keepPreviousData,
  });
  return {
    wards: data ?? [],
    /** True only before the first answer; a refetch keeps the old list. */
    loading: isPending,
    error: error ?? null,
    retry: () => {
      void refetch();
    },
  };
}

/**
 * The read plus the write into `family.store`, for the screens that own the
 * switcher (guardian home, the homework route). Only an ANSWERED read reaches
 * `setChildren`: a failed first fetch leaves the store as it was, so a parent
 * with a cached selection keeps it through an outage, and a loading state is
 * never mistaken for "no children".
 *
 * `data` from Query is referentially stable between answers, so the effect
 * runs once per answer rather than once per render.
 */
export function useGuardianWardsSync() {
  const read = useGuardianWards();
  const setChildren = useFamilyStore((s) => s.setChildren);
  const { wards, loading, error } = read;
  useEffect(() => {
    if (loading || error !== null) return;
    setChildren(wards);
  }, [wards, loading, error, setChildren]);
  return read;
}
