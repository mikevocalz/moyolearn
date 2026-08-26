'use client';
// The write path: React 19 `useActionState` + `useOptimistic`, reconciled with
// Query by invalidating exactly one key when the server settles.
//
// The fourth trap, stated as code: Query is the READ model and never learns
// about a pending edit; this hook is the WRITE model and never caches. The row
// the user sees mid-flight comes from `useOptimistic` applying the same pure
// reducer the server will apply — so the optimistic view and the committed view
// cannot disagree.
// SOT: docs/pack/28-crm-spec.md §3 · docs/pack/17-interaction-quality-spec.md
// SOT-KEYWORDS: ops write stage action optimistic useActionState invalidate query
import { useActionState, useOptimistic } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { applyStageChange, type StageChange } from './stage-change';
import type { Lead } from './ops.data';

export interface StageActionState {
  /** Set when the last attempt failed. Cleared on the next attempt. */
  error?: string;
}

const API_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? process.env.EXPO_PUBLIC_APP_URL ?? 'http://localhost:3001';

/**
 * @param rows      the server rows, straight from the read hook
 * @param queryKey  returned by `useLeads` — invalidating precisely this surface
 *                  rather than the whole cache is why the hook hands it back
 */
export function useStageAction(rows: Lead[], queryKey: readonly unknown[]) {
  const queryClient = useQueryClient();

  /*
    `useOptimistic` is seeded from the SERVER rows, so when the query refetches
    after invalidation the optimistic layer collapses onto the real data by
    itself. Seeding it from local state instead is what makes an optimistic UI
    drift — the pending edit outlives the response that superseded it.
  */
  const [optimisticRows, addOptimistic] = useOptimistic(rows, (current, change: StageChange) =>
    applyStageChange(current, change),
  );

  const [state, submit, pending] = useActionState<StageActionState, StageChange>(
    async (_prev, change) => {
      addOptimistic(change);
      try {
        const res = await fetch(`${API_URL}/api/ops/leads/${change.leadId}/stage`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ stage: change.to }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return {};
      } catch (error) {
        // The optimistic row reverts on its own when the action settles; all
        // this has to do is say what happened, in the interface's voice.
        return { error: error instanceof Error ? error.message : 'Could not move that family' };
      } finally {
        /*
          Invalidate on SETTLE, not on success. A failed write still leaves the
          client holding a row it optimistically changed, and the only honest
          way back is to re-read the server rather than guess at a rollback.
        */
        await queryClient.invalidateQueries({ queryKey });
      }
    },
    {},
  );

  return { rows: optimisticRows, moveStage: submit, pending, error: state.error };
}
