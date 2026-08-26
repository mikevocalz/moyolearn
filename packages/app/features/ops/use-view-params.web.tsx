'use client';
// PLATFORM FORK — the shareable view lives in the URL on web.
//
// Sorting, filters and the active view go here rather than into a store because
// people SHARE and BOOKMARK them: "the at-risk families I own, by value" is a
// link you paste to a colleague. Anything nobody would paste — sidebar collapse,
// density, hidden columns — stays in Zustand (`ops.store.ts`).
// SOT: docs/pack/28-crm-spec.md §3 (views are saved configurations)
// SOT-KEYWORDS: ops view params url searchparams shareable sort filter web
import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { LeadSortField } from './ops.service';
import type { Stage } from './ops.data';
import type { ShareableView, ViewParams } from './use-view-params.types';

export function useViewParams(): ViewParams {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const view = useMemo<ShareableView>(
    () => ({
      q: params.get('q') ?? '',
      stage: (params.get('stage') as Stage | null) ?? undefined,
      onlyAttention: params.get('attention') !== '0',
      sortField: (params.get('sort') as LeadSortField | null) ?? undefined,
      sortDesc: params.get('desc') === '1',
      cursor: params.get('cursor') ?? undefined,
    }),
    [params],
  );

  const setView = useCallback(
    (patch: Partial<ShareableView>) => {
      const next = { ...view, ...patch };
      // Any change to the ORDERING invalidates the cursor: a cursor names a row
      // in one particular ordering, so reusing it under another returns a page
      // from the middle of the old one.
      if (!('cursor' in patch)) next.cursor = undefined;

      const sp = new URLSearchParams();
      if (next.q) sp.set('q', next.q);
      if (next.stage) sp.set('stage', next.stage);
      if (!next.onlyAttention) sp.set('attention', '0');
      if (next.sortField) {
        sp.set('sort', next.sortField);
        if (next.sortDesc) sp.set('desc', '1');
      }
      if (next.cursor) sp.set('cursor', next.cursor);

      // `scroll: false` — re-sorting a table should not throw the reader back to
      // the top of the page they were already reading.
      router.replace(sp.size ? `${pathname}?${sp}` : pathname, { scroll: false });
    },
    [view, pathname, router],
  );

  return { view, setView };
}
