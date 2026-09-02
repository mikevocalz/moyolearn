// The Families read model's pure half — the stage rollup over a household's
// leads, and the join that attaches it to the org's family rows.
//
// ADR-109 retired the interim name-text derivation this file used to hold:
// doc 28 §2's Family (household) is a first-class collection now, and leads
// carry a stamped `familyId` pointer. What survives here is the arithmetic
// with judgement calls in it — stage order, aggregate honesty, the
// attention-first sort, the stamp-with-name-fallback join.
//
// Pure and outside ops.service for the lead-stats reason: arithmetic with a
// judgement call in it is the part that earns a test, and a module the test
// runner cannot import (server-only) is a module nobody checks.
// SOT: docs/pack/28-crm-spec.md §2 (object model) · docs/decisions/adr-109-family-household-object.md
// SOT-KEYWORDS: families rollup household crm leads pure join stamp stages value
import type { Lead, Stage } from './ops.data.ts';

/** The household row as the join needs it — id and label, nothing else. */
export interface FamilyName {
  id: string;
  name: string;
}

export interface FamilyGroup {
  /** The `families` document id — what makes the row openable. */
  id: string;
  /** The household label, from the family row (not from lead text). */
  family: string;
  /** How many pipeline rows belong to this household. */
  leads: number;
  /** Stages present among them, in pipeline order — never per-lead detail. */
  stages: Stage[];
  /** Sum of the household's lead values, formatted the way the rows are. */
  totalValue: string;
  /** True when ANY lead in the household needs a decision. */
  needsAttention: boolean;
}

/** The per-household half of a FamilyGroup — what `familyRollup` computes. */
export type FamilyRollup = Omit<FamilyGroup, 'id' | 'family'>;

/** Pipeline order for the stage chips — the enum's own order, not alphabetical. */
const STAGE_ORDER: readonly Stage[] = [
  'Inquiry',
  'Trial scheduled',
  'Trial completed',
  'Proposal',
  'Enrolled',
  'At risk',
];

/**
 * Parses the display value back to a number. The repository formats cents into
 * whole-dollar strings at the edge and the service's whole read model carries
 * that shape — so the rollup sums what the rows carry rather than asking for a
 * second, cents-shaped read that only this screen would use.
 */
export const leadValueNumber = (value: string): number =>
  Number(value.replace(/[^0-9.-]/g, '')) || 0;

/**
 * The leads belonging to one household. The stamp (`familyId`) is the join —
 * checked FIRST, so a renamed household keeps its stamped leads. The trimmed
 * name match is the fallback for rows the stamp has not reached: a lead
 * written by a deployment predating ADR-109's create-time upsert. A stamped
 * lead never falls through to the name match — its stamp is its answer, even
 * when it points at a different household with the same spelling.
 */
export const leadsOfFamily = (family: FamilyName, rows: readonly Lead[]): Lead[] =>
  rows.filter((row) =>
    row.familyId !== undefined && row.familyId !== ''
      ? row.familyId === family.id
      : row.family.trim() === family.name,
  );

/** The stage/value/attention summary over one household's leads. */
export function familyRollup(rows: readonly Lead[]): FamilyRollup {
  const present = new Set(rows.map((l) => l.stage));
  const total = rows.reduce((sum, l) => sum + leadValueNumber(l.value), 0);
  return {
    leads: rows.length,
    stages: STAGE_ORDER.filter((s) => present.has(s)),
    // 'en-US' pinned for the hydration reason the revenue chart documents.
    totalValue: `$${total.toLocaleString('en-US')}`,
    needsAttention: rows.some((l) => l.needsAttention === true),
  };
}

/**
 * Joins the org's family rows to its pipeline. Every household renders — a
 * family with zero leads is a real record now, not a grouping artifact.
 * Sorted needs-attention first, then by name, so the families waiting on a
 * decision surface before the alphabet does.
 */
export function attachRollups(
  families: readonly FamilyName[],
  rows: readonly Lead[],
): FamilyGroup[] {
  const groups = families.map<FamilyGroup>((family) => ({
    id: family.id,
    family: family.name,
    ...familyRollup(leadsOfFamily(family, rows)),
  }));

  return groups.sort((a, b) =>
    a.needsAttention === b.needsAttention
      ? a.family.localeCompare(b.family)
      : a.needsAttention
        ? -1
        : 1,
  );
}
