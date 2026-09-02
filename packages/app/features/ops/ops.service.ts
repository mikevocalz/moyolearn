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
import type { ProtectedCtx } from '../../core/protected-operation.ts';
import type { Lead, Stage } from './ops.data.ts';
import { clearsAttention, type StageChange } from './stage-change.ts';
// Pure and therefore testable — see the headers of those files.
import { statsFor, type LeadStats } from './lead-stats.ts';
import { familiesFrom, leadValueNumber, type FamilyGroup } from './family-groups.ts';
import { NEW_LEAD_STAGE, type NewLeadInput } from './lead-create.ts';

export type { FamilyGroup, LeadStats, NewLeadInput };

/** Repository ports — the caller provides the Payload adapters. */
export type LoadLeads = (ctx: ProtectedCtx) => Promise<readonly Lead[]>;

/** Resolves one lead by id WITHIN the caller's org, or null — never across it. */
export type LoadLead = (ctx: ProtectedCtx, leadId: string) => Promise<Lead | null>;

/**
 * Persists a new lead. The stage is fixed by the service (`NEW_LEAD_STAGE`) and
 * `orgId` comes off `ctx` inside the repository — neither is caller input.
 */
export type CreateLeadRecord = (
  ctx: ProtectedCtx,
  input: NewLeadInput & { stage: Stage },
) => Promise<Lead>;

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
  stats: LeadStats;
}

const EMPTY: ListLeadsResult = {
  rows: [],
  total: 0,
  totalUnfiltered: 0,
  stats: { needsAttention: 0, sessionsDelivered: 0 },
};


const compare = (a: Lead, b: Lead, field: LeadSortField): number => {
  switch (field) {
    case 'sessions':
      return a.sessions - b.sessions;
    case 'value':
      return leadValueNumber(a.value) - leadValueNumber(b.value);
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
    // From `all`, never from `page`: a statistic that changes when you filter or
    // turn to page two is not a statistic about the business.
    stats: statsFor(all),
  };
}

/**
 * One record, for the route-based detail. The tenant guard is the same shape
 * as every read here: no org on the session resolves to nothing, and the
 * repository applies `orgId` to the predicate so a guessed id from another
 * tenant is a miss, not a leak.
 */
export async function getLead(
  ctx: ProtectedCtx,
  leadId: string,
  loadLead: LoadLead,
): Promise<Lead | null> {
  if (!ctx.orgId) return null;
  return loadLead(ctx, leadId);
}

/**
 * The interim Families read — the pipeline grouped by family text, server-side
 * (see family-groups.ts for why this derivation exists instead of a household
 * collection). Rides the same repository read the pipeline uses, so the wall
 * holds by construction: nothing here can see what the leads read cannot.
 */
export async function listFamilies(
  ctx: ProtectedCtx,
  loadLeads: LoadLeads,
): Promise<{ families: FamilyGroup[] }> {
  if (!ctx.orgId) return { families: [] };
  return { families: familiesFrom(await loadLeads(ctx)) };
}

/**
 * Creates a lead at the pipeline's first stage. Validation happened at the
 * route (`parseNewLead` — pure, tested); what the service owns is the tenant
 * guard and the stage assignment, because a client that could choose either
 * could write into someone else's funnel or skip its own.
 */
export async function createLead(
  ctx: ProtectedCtx,
  input: NewLeadInput,
  createLeadRecord: CreateLeadRecord,
): Promise<Lead | null> {
  if (!ctx.orgId) return null;
  return createLeadRecord(ctx, { ...input, stage: NEW_LEAD_STAGE });
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
