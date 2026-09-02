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

/**
 * Moving a family OUT of a decision stage clears its attention flag — that is
 * the point of moving it. Leaving the flag set would keep the row in the "needs
 * attention" filter after the user just dealt with it, which reads as the action
 * having failed.
 *
 * Exported because the optimistic reducer below and the persisted write must
 * agree. When this was an inline ternary in one and a re-derivation in the
 * other, the row's flag flipped back on the refetch.
 */
export const clearsAttention = (to: Stage): boolean => to === 'Enrolled' || to === 'At risk';

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
          needsAttention: clearsAttention(change.to) ? false : row.needsAttention,
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

/**
 * Translates a board drop into the ONE write this pipeline has, or into
 * nothing. Pure so the board's gate is testable beside the reducer it feeds:
 *
 *  - a drop in the card's own column is a re-order, and no manual ordering
 *    exists to write — the server owns sort, so the card simply settles back;
 *  - a drop into a column outside MANUAL_STAGES ('At risk') is refused for the
 *    same reason the table's menu never offers it: the scorer owns that stage,
 *    and the card visibly snaps home instead of pretending the move took.
 *
 * Column ids arrive as strings from the generic StageBoard; the MANUAL_STAGES
 * lookup is also the narrowing back to Stage, exactly as the route validates.
 */
export function boardStageChange(
  leadId: string,
  fromColumnId: string,
  toColumnId: string,
): StageChange | null {
  if (toColumnId === fromColumnId) return null;
  const to = MANUAL_STAGES.find((stage) => stage === toColumnId);
  if (to === undefined) return null;
  return { leadId, to };
}
