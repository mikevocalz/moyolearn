// The write model for a lead's pipeline stage.
//
// Deliberately NOT `'use client'`: this module is pure data and a pure reducer,
// and BOTH sides need it — the client applies it optimistically, the route
// validates against the same list. Marked as client it became a client-
// reference proxy inside the route, where `MANUAL_STAGES.find` is not a
// function. Only the hook that uses React APIs carries the directive.
//
// Reads and writes are different systems, and this file is the seam. Query owns
// the read model; a user's edit goes through a PURE reducer here, is shown
// optimistically, and the query key is invalidated once the server settles.
// Two optimistic systems over the same rows is how a row ends up showing a
// stage nobody chose — so the reducer below never fetches and never caches.
// SOT: docs/pack/28-crm-spec.md §3 (pipeline) · CLAUDE.md (The block)
// SOT-KEYWORDS: ops write stage change reducer optimistic action invalidate crm
import type { Lead, Stage } from './ops.data';

export interface StageChange {
  leadId: string;
  to: Stage;
}

export type StageChangeResult =
  | { ok: true; rows: Lead[] }
  | { ok: false; error: string; rows: Lead[] };

/**
 * The whole state transition, as a pure function of (rows, change).
 *
 * Pure on purpose: it is what `useOptimistic` applies locally AND what the
 * server result is reconciled against, so the optimistic view and the committed
 * view cannot drift apart by construction. It is also directly testable without
 * a renderer or a network.
 */
export function applyStageChange(rows: readonly Lead[], change: StageChange): Lead[] {
  return rows.map((row) =>
    row.id === change.leadId
      ? {
          ...row,
          stage: change.to,
          /*
            Moving a family OUT of a decision stage clears its attention flag —
            that is the point of moving it. Leaving the flag set would keep the
            row in the "needs attention" filter after the user just dealt with
            it, which reads as the action having failed.
          */
          needsAttention: change.to === 'Enrolled' || change.to === 'At risk' ? false : row.needsAttention,
        }
      : row,
  );
}

/**
 * Stages a user may move a lead to by hand. `At risk` is deliberately absent:
 * doc 28 §6 derives it from health signals — missed sessions, invoice lateness
 * — so offering it as a choice would let someone hand-set a value the scorer
 * overwrites on the next run.
 */
export const MANUAL_STAGES = [
  'Inquiry',
  'Trial scheduled',
  'Trial completed',
  'Proposal',
  'Enrolled',
] as const satisfies readonly Stage[];
