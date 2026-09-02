'use client';
// The ops pipeline read model. ONE system owns each concern:
//
//   TanStack Query   fetching, caching, invalidation
//   TanStack Table   sort/filter/selection models (built in the screen)
//   TanStack Pacer   WHEN the search value reaches the query key
//   URL search params  sort + filters + view — the shareable state
//   Zustand          durable view prefs nobody would paste into Slack
//
// SOT: docs/pack/28-crm-spec.md §3 · CLAUDE.md (UI · state) · packages/app/core/api-fetch.ts
// SOT-KEYWORDS: ops leads hook query cursor pagination pacer debounce searchparams api error retry
import { useMemo } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDebouncedValue } from '@tanstack/react-pacer';
import type { Lead, Stage } from './ops.data';
import type { LeadSortField, LeadStats, NewLeadInput } from './ops.service';
import { API_URL } from '../../core/api-url.ts';
import { getJson, isNotFound } from '../../core/api-fetch.ts';

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
  stats: LeadStats;
}

/**
 * The list views' common PREFIX — what `useCreateLead` invalidates, because a
 * new lead can appear in any cached view. The record keys (`leadQueryKey`)
 * deliberately live under a different root so a prefix invalidation of the
 * lists never matches a record page the mutation did not touch.
 */
export const leadsScopeKey = () => ['ops', 'leads'] as const;

/**
 * Exported so a write path can invalidate EXACTLY this surface after a mutation
 * settles, rather than nuking the whole cache and refetching six other screens.
 */
export const leadsQueryKey = (view: LeadsView) => [...leadsScopeKey(), view] as const;

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
      /*
        `getJson` carries the status as data (core/api-fetch.ts): the retry
        predicate stops backing off on a settled 401/403, so the table reaches
        its error branch on the first response instead of holding "Loading…"
        through the whole backoff — and the branch can then say "signed out"
        rather than offering a retry that fails identically forever.
      */
      return getJson<LeadsPage>(`/api/ops/leads?${params.toString()}`, signal);
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

/**
 * A distinct root from the list views' `['ops','leads',view]`, so the detail
 * key can be invalidated by itself — and so `useCreateLead`'s prefix
 * invalidation of every list view does not accidentally match a record page
 * the mutation did not touch.
 */
export const leadQueryKey = (leadId: string) => ['ops', 'lead', leadId] as const;

/** One record, for the route-based lead detail. A 404 surfaces as `null`. */
export function useLead(leadId: string) {
  const queryKey = leadQueryKey(leadId);
  const query = useQuery({
    queryKey,
    queryFn: async ({ signal }): Promise<Lead | null> => {
      try {
        return (
          await getJson<{ lead: Lead }>(`/api/ops/leads/${encodeURIComponent(leadId)}`, signal)
        ).lead;
      } catch (error) {
        // A miss is a STATE the screen renders (gone from this pipeline), not
        // an error to retry — retrying a 404 would just re-ask for the same
        // absence. Every OTHER status stays an error, so a failed read is
        // never mistaken for a record that does not exist.
        if (isNotFound(error)) return null;
        throw error;
      }
    },
    enabled: leadId.length > 0,
  });
  return { ...query, queryKey, lead: query.data ?? null };
}

/**
 * The create door. Invalidates the list views' PREFIX (`leadsScopeKey`) —
 * every cached view, whatever its filters — because a new lead can appear in
 * any of them, and invalidating one exact view would leave the others showing
 * a pipeline that no longer exists.
 */
export function useCreateLead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewLeadInput): Promise<Lead> => {
      const res = await fetch(`${API_URL}/api/ops/leads`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      return ((await res.json()) as { lead: Lead }).lead;
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: leadsScopeKey() });
    },
  });
}
