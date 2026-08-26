import 'server-only';
// Lead listing for the ops dashboard — cursor paginated, sorted and filtered on
// the server so the client never pulls a whole CRM table to slice it locally.
//
// The data source is still the doc-28 fixture set: the CRM collections land with
// PR-72. Everything ABOVE this function is already the real contract — cursor
// semantics, the filter shape, the response envelope — so swapping the fixture
// array for a repository call is a change to this file and nothing else.
// SOT: docs/pack/28-crm-spec.md §2–§3
// SOT-KEYWORDS: ops service leads cursor pagination filter sort server-only crm
import { LEADS, type Lead, type Stage } from './ops.data';
import { applyStageChange, type StageChange } from './stage-change';

/*
  In-memory stage overrides, so a write is visible on the next read.

  Without this the route validated a change and discarded it, the optimistic row
  reverted on the refetch, and the feature looked broken while behaving
  correctly — the server genuinely had not changed.

  Keyed off `globalThis`, not a plain module const: Next bundles each route
  separately, so `GET /leads` and `POST /leads/:id/stage` each got their OWN
  copy of this module and the write landed in a Map the read never saw. Same
  reason the Prisma-client singleton is written this way. It also survives HMR,
  which would otherwise reset the fixture on every save.

  Process-local and lost on restart, which is what a fixture should be; the CRM
  repositories (doc 28 PR-72) replace this map, not the code around it.
*/
const OVERRIDES_KEY = Symbol.for('@acme/app/ops/stage-overrides');
const globalStore = globalThis as typeof globalThis & {
  [OVERRIDES_KEY]?: Map<string, Stage>;
};
const stageOverrides = (globalStore[OVERRIDES_KEY] ??= new Map<string, Stage>());

export function commitStageChange(change: StageChange): void {
  stageOverrides.set(change.leadId, change.to);
}

const withOverrides = (): Lead[] => {
  let rows = LEADS.map((lead) => ({ ...lead }));
  for (const [leadId, to] of stageOverrides) {
    rows = applyStageChange(rows, { leadId, to });
  }
  return rows;
};

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
 * `protectedOperation` boundary and is applied here, never accepted from the
 * client (CLAUDE.md · The block).
 */
export function listLeads(_ctx: { orgId?: string }, input: ListLeadsInput): ListLeadsResult {
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
  const needle = input.q?.trim().toLowerCase();

  let rows = withOverrides();

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
    totalUnfiltered: LEADS.length,
  };
}
