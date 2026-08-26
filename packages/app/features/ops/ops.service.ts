import 'server-only';
// Lead listing for the ops dashboard — cursor paginated, sorted and filtered on
// the server so the client never pulls a whole CRM table to slice it locally.
//
// The rows come from the `leads` collection through a repository port. This file
// owns the read model — cursor semantics, the filter shape, the response
// envelope, the tenant guard — and knows nothing about Payload; `leads.repository`
// in apps/web is the only place that does (CLAUDE.md · The block).
// SOT: docs/pack/28-crm-spec.md §2–§3
// SOT-KEYWORDS: ops service leads cursor pagination filter sort server-only crm repository
import type { ProtectedCtx } from '../../core/protected-operation';
import type { Lead, Stage } from './ops.data';
import { clearsAttention, type StageChange } from './stage-change';

/** Repository ports — the caller provides the Payload adapters. */
export type LoadLeads = (ctx: ProtectedCtx) => Promise<readonly Lead[]>;

/**
 * Persists one stage move. Resolves FALSE when no lead in the caller's org has
 * that id, so a cross-tenant id fails loudly instead of reporting a write that
 * never happened.
 */
export type SaveLeadStage = (
  ctx: ProtectedCtx,
  leadId: string,
  patch: LeadStagePatch,
) => Promise<boolean>;

export interface LeadStagePatch {
  stage: Stage;
  /**
   * Only ever `false`, and only when the move clears the flag. Absent means
   * "leave it alone" — a write that always sent a boolean would re-raise the
   * flag on every move the scorer had just cleared.
   */
  needsAttention?: false;
}

export type LeadSortField = 'family' | 'stage' | 'owner' | 'sessions' | 'value';

export interface ListLeadsInput {
  /** Opaque cursor from the previous page's `nextCursor`. */
  cursor?: string;
  limit?: number;
  sort?: { field: LeadSortField; desc: boolean };
  /** Free text over family, learner and subject. */
  q?: string;
  stage?: Stage;
  onlyAttention?: boolean;
}

export interface ListLeadsResult {
  rows: Lead[];
  /** Absent when this is the last page. */
  nextCursor?: string;
  /** Count AFTER filtering, so the footer can say "12 of 84". */
  total: number;
  /** Count before filtering — the "show all" affordance needs it. */
  totalUnfiltered: number;
}

const EMPTY: ListLeadsResult = { rows: [], total: 0, totalUnfiltered: 0 };

const numericValue = (v: string) => Number(v.replace(/[^0-9.-]/g, '')) || 0;

const compare = (a: Lead, b: Lead, field: LeadSortField): number => {
  switch (field) {
    case 'sessions':
      return a.sessions - b.sessions;
    case 'value':
      return numericValue(a.value) - numericValue(b.value);
    default:
      return String(a[field]).localeCompare(String(b[field]));
  }
};

/**
 * CURSOR, not offset. An offset drifts the moment a row is inserted or deleted
 * mid-scroll — page 2 re-shows a row from page 1, or skips one — and a live CRM
 * inserts constantly. A cursor names the last row seen, so the next page starts
 * after that row no matter what happened around it.
 *
 * Identity is never a parameter: `orgId` arrives on `ctx` at the route's
 * `protectedOperation` boundary and is applied by the repository, never accepted
 * from the client (CLAUDE.md · The block). A session with no org resolves to an
 * empty page rather than an unscoped read — an ops dashboard that fails open is
 * a cross-tenant leak.
 *
 * The repository returns the org's rows and this function slices them, because
 * filter, sort and cursor all have to agree on one ordering and splitting that
 * across two systems is how a cursor starts pointing into a different sort. A
 * tutoring org holds thousands of leads, not millions; when one outgrows a
 * single read, `LoadLeads` is where the predicate moves, not this function.
 */
export async function listLeads(
  ctx: ProtectedCtx,
  input: ListLeadsInput,
  loadLeads: LoadLeads,
): Promise<ListLeadsResult> {
  if (!ctx.orgId) return EMPTY;

  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
  const needle = input.q?.trim().toLowerCase();

  const all = await loadLeads(ctx);
  let rows = [...all];

  if (input.onlyAttention) rows = rows.filter((l) => l.needsAttention);
  if (input.stage) rows = rows.filter((l) => l.stage === input.stage);
  if (needle) {
    rows = rows.filter((l) =>
      `${l.family} ${l.learner} ${l.subject}`.toLowerCase().includes(needle),
    );
  }

  if (input.sort) {
    const { field, desc } = input.sort;
    rows.sort((a, b) => (desc ? -compare(a, b, field) : compare(a, b, field)));
  }

  const total = rows.length;

  // The cursor is the id of the last row of the previous page. Resolving it
  // AFTER sorting and filtering is what makes it stable: the same cursor under a
  // different sort is meaningless, so the client discards it on a sort change.
  const start = input.cursor ? rows.findIndex((l) => l.id === input.cursor) + 1 : 0;
  const page = rows.slice(start, start + limit);
  const last = page[page.length - 1];

  return {
    rows: page,
    nextCursor: start + limit < total && last ? last.id : undefined,
    total,
    totalUnfiltered: all.length,
  };
}

/**
 * The write half of the pipeline. The attention flag is derived from the SAME
 * predicate the optimistic reducer uses, so the row the user sees during the
 * mutation and the row that comes back on the refetch cannot disagree.
 */
export async function commitStageChange(
  ctx: ProtectedCtx,
  change: StageChange,
  saveLeadStage: SaveLeadStage,
): Promise<boolean> {
  if (!ctx.orgId) return false;
  return saveLeadStage(ctx, change.leadId, {
    stage: change.to,
    ...(clearsAttention(change.to) ? { needsAttention: false as const } : {}),
  });
}
