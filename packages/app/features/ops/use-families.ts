'use client';
// The Families read hooks — the ADR-109 household rows (list with rollups,
// one record with its leads) and the record's one write surface. Query owns
// the rows, exactly as the pipeline's read model does; there is no view state
// because there are no filters on this surface yet.
// SOT: docs/pack/28-crm-spec.md §2 · docs/decisions/adr-109-family-household-object.md · packages/app/core/api-fetch.ts
// SOT-KEYWORDS: families hook query crm household detail contacts mutation client read api error retry
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FamilyGroup } from './family-groups';
import type { FamilyContact, FamilyRecord } from './family-record';
import type { Lead } from './ops.data';
import { API_URL } from '../../core/api-url.ts';
import { getJson, isNotFound } from '../../core/api-fetch.ts';

export const familiesQueryKey = () => ['ops', 'families'] as const;

export function useFamilies() {
  const query = useQuery({
    queryKey: familiesQueryKey(),
    // `getJson` — the status survives as data, so a 401 settles on the first
    // response (no backoff spent in `pending`, i.e. no skeletons standing in
    // for an answered refusal) and the screen can name the right way out.
    queryFn: async ({ signal }): Promise<FamilyGroup[]> =>
      (await getJson<{ families: FamilyGroup[] }>('/api/ops/families', signal)).families,
    placeholderData: keepPreviousData,
  });
  return { ...query, families: query.data ?? [] };
}

/** What GET /api/ops/families/:id returns — the record plus its pipeline rows. */
export interface FamilyDetailPayload {
  family: FamilyRecord;
  leads: Lead[];
}

/**
 * A distinct root from the list's `['ops','families']`, the leadQueryKey
 * pattern: the record key invalidates by itself, and a prefix invalidation of
 * the list never matches a record page it did not touch.
 */
export const familyQueryKey = (familyId: string) => ['ops', 'family', familyId] as const;

/** One household record, for the route-based family detail. A 404 surfaces as `null`. */
export function useFamily(familyId: string) {
  const queryKey = familyQueryKey(familyId);
  const query = useQuery({
    queryKey,
    queryFn: async ({ signal }): Promise<FamilyDetailPayload | null> => {
      try {
        return await getJson<FamilyDetailPayload>(
          `/api/ops/families/${encodeURIComponent(familyId)}`,
          signal,
        );
      } catch (error) {
        // A miss is a STATE the screen renders (not in this org's records),
        // not an error to retry — retrying a 404 would just re-ask for the
        // same absence. Every other status stays an error, so a failed read
        // never renders as a household that does not exist.
        if (isNotFound(error)) return null;
        throw error;
      }
    },
    enabled: familyId.length > 0,
  });
  return { ...query, queryKey, detail: query.data ?? null };
}

/**
 * The contacts write. Deliberately NOT optimistic (unlike use-stage-action):
 * a stage move is a high-frequency drag with a reducer both sides share,
 * while a contact edit is a rare business-record write where "saved" must
 * mean saved — failure stays visible through the mutation's error state and
 * the form keeps the unsaved values for retry. On success the record's EXACT
 * key invalidates; the list is untouched because contacts do not appear on it.
 */
export function useUpdateFamilyContacts(familyId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (contacts: FamilyContact[]): Promise<FamilyRecord> => {
      const res = await fetch(`${API_URL}/api/ops/families/${encodeURIComponent(familyId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contacts }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      return ((await res.json()) as { family: FamilyRecord }).family;
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: familyQueryKey(familyId) });
    },
  });
}
