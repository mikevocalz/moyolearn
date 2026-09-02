'use client';
// The Families read hook — the interim server-derived grouping (family-groups.ts
// explains why this is a derivation and not a household collection). Query owns
// the rows, exactly as the pipeline's read model does; there is no view state
// because there are no filters on this surface yet.
// SOT: docs/pack/28-crm-spec.md §2 · packages/app/features/ops/family-groups.ts
// SOT-KEYWORDS: families hook query crm derived grouping client read
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { FamilyGroup } from './family-groups';

const API_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? process.env.EXPO_PUBLIC_APP_URL ?? 'http://localhost:3001';

export const familiesQueryKey = () => ['ops', 'families'] as const;

export function useFamilies() {
  const query = useQuery({
    queryKey: familiesQueryKey(),
    queryFn: async ({ signal }): Promise<FamilyGroup[]> => {
      const res = await fetch(`${API_URL}/api/ops/families`, {
        credentials: 'include',
        signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return ((await res.json()) as { families: FamilyGroup[] }).families;
    },
    placeholderData: keepPreviousData,
  });
  return { ...query, families: query.data ?? [] };
}
