'use client';
// The ops pipeline read model. ONE system owns each concern:
//
//   TanStack Query   fetching, caching, invalidation
//   TanStack Table   sort/filter/selection models (built in the screen)
//   TanStack Pacer   WHEN the search value reaches the query key
//   URL search params  sort + filters + view — the shareable state
//   Zustand          durable view prefs nobody would paste into Slack
//
// SOT: docs/pack/28-crm-spec.md §3 · CLAUDE.md (UI · state)
// SOT-KEYWORDS: ops leads hook query cursor pagination pacer debounce searchparams
import { useMemo } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useDebouncedValue } from '@tanstack/react-pacer';
import type { Lead, Stage } from './ops.data';
import type { LeadSortField } from './ops.service';

const API_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? process.env.EXPO_PUBLIC_APP_URL ?? 'http://localhost:3001';

export interface LeadsView {
  q: string;
  stage?: Stage;
  onlyAttention: boolean;
  sortField?: LeadSortField;
  sortDesc: boolean;
  /** Cursor for the page being viewed; undefined is the first page. */
  cursor?: string;
  limit: number;
}

export interface LeadsPage {
  rows: Lead[];
  nextCursor?: string;
  total: number;
  totalUnfiltered: number;
}

/**
 * Exported so a write path can invalidate EXACTLY this surface after a mutation
 * settles, rather than nuking the whole cache and refetching six other screens.
 */
export const leadsQueryKey = (view: LeadsView) => ['ops', 'leads', view] as const;

export function useLeads(view: LeadsView) {
  /*
    TRAP 2 — debounce the INPUT, not the fetch.

    Two values, deliberately: `view.q` updates on every keystroke so the field
    stays responsive, and only the debounced copy reaches the query key. Putting
    the raw value in the key and debouncing the fetch instead would make Query
    cache a distinct entry per keystroke — Query already dedupes in-flight
    requests, so the thing that needs slowing down is the KEY, not the network.

    If someone later "simplifies" these back into one value, every character
    typed becomes a cache entry and a request.
  */
  const [debouncedQ] = useDebouncedValue(view.q, { wait: 300 });

  /*
    A cursor is only meaningful within one sort+filter ordering, so any change to
    those must reset it. Carrying a stale cursor across a sort silently returns a
    page from the middle of the previous ordering.
  */
  const effective = useMemo<LeadsView>(
    () => ({ ...view, q: debouncedQ, cursor: view.cursor }),
    [view, debouncedQ],
  );

  const queryKey = leadsQueryKey(effective);

  const query = useQuery({
    queryKey,
    queryFn: async ({ signal }): Promise<LeadsPage> => {
      const params = new URLSearchParams();
      if (effective.cursor) params.set('cursor', effective.cursor);
      params.set('limit', String(effective.limit));
      if (effective.q) params.set('q', effective.q);
      if (effective.stage) params.set('stage', effective.stage);
      if (effective.onlyAttention) params.set('attention', '1');
      if (effective.sortField) {
        params.set('sortField', effective.sortField);
        params.set('sortDesc', effective.sortDesc ? '1' : '0');
      }
      const res = await fetch(`${API_URL}/api/ops/leads?${params}`, {
        credentials: 'include',
        signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as LeadsPage;
    },
    /*
      Without this the table flashes empty on every sort and page change, which
      on a dense grid reads as "my data disappeared" rather than "it is loading".
      The previous page stays on screen until the next one resolves.
    */
    placeholderData: keepPreviousData,
  });

  return {
    ...query,
    /** Handed back so the write path can invalidate precisely this view. */
    queryKey,
    page: query.data,
    rows: query.data?.rows ?? [],
  };
}
