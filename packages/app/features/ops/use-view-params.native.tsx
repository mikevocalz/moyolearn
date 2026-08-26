'use client';
// PLATFORM FORK — native has no URL to share, so the view is in-memory.
//
// Deliberately NOT persisted: a filter restored days later, silently, is how
// someone concludes half their pipeline vanished. The web fork keeps it in the
// URL precisely because there the state is visible in the address bar.
// SOT-KEYWORDS: ops view params native in-memory sort filter store
import { useCallback } from 'react';
import { useInstanceStore, useStore } from '@acme/ui';
import type { ShareableView, ViewParams } from './use-view-params.types';

const INITIAL: ShareableView = { q: '', onlyAttention: true, sortDesc: false };

export function useViewParams(): ViewParams {
  const store = useInstanceStore<ShareableView>(() => INITIAL);
  const view = useStore(store, (s) => s);

  const setView = useCallback(
    (patch: Partial<ShareableView>) =>
      store.setState((s) => ({
        ...s,
        ...patch,
        ...('cursor' in patch ? null : { cursor: undefined }),
      })),
    [store],
  );

  return { view, setView };
}
