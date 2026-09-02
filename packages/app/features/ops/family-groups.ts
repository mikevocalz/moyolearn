// The interim /families read model — a pure grouping of the pipeline by its
// family text.
//
// Doc 28 §2 specifies Org → Family (household) → GuardianContact as first-class
// objects, and NONE of them exist as collections yet. Rather than fake a
// household schema or ship an empty rail destination, the Families surface is
// DERIVED: leads grouped by their `family` string, each group carrying the
// facts the pipeline already holds. It is a real list with zero new schema —
// and it is deliberately shallow: a group is not openable, because there is no
// household object behind it to open. A future ADR builds the Family /
// GuardianContact record and replaces this derivation with a real read.
//
// Pure and outside ops.service for the lead-stats reason: arithmetic with a
// judgement call in it is the part that earns a test, and a module the test
// runner cannot import (server-only) is a module nobody checks.
// SOT: docs/pack/28-crm-spec.md §2 (object model — Family/GuardianContact unbuilt)
// SOT-KEYWORDS: families grouping derived household interim crm leads pure
import type { Lead, Stage } from './ops.data.ts';

export interface FamilyGroup {
  /** The grouping key — the lead rows' family text, verbatim. */
  family: string;
  /** How many pipeline rows name this family. */
  leads: number;
  /** Stages present in the group, in pipeline order — never per-lead detail. */
  stages: Stage[];
  /** Sum of the group's lead values, formatted the way the rows are. */
  totalValue: string;
  /** True when ANY lead in the group needs a decision. */
  needsAttention: boolean;
}

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
 * that shape — so the interim grouping sums what the rows carry rather than
 * asking for a second, cents-shaped read that only this screen would use. The
 * household ADR replaces this with a real aggregate over `valueCents`.
 */
export const leadValueNumber = (value: string): number =>
  Number(value.replace(/[^0-9.-]/g, '')) || 0;

/**
 * Groups the org's leads by family text. Sorted needs-attention first, then by
 * name, so the families waiting on a decision surface before the alphabet does.
 */
export function familiesFrom(rows: readonly Lead[]): FamilyGroup[] {
  const byFamily = new Map<string, Lead[]>();
  for (const row of rows) {
    const key = row.family.trim();
    if (key.length === 0) continue;
    const group = byFamily.get(key);
    if (group) group.push(row);
    else byFamily.set(key, [row]);
  }

  const groups = [...byFamily.entries()].map<FamilyGroup>(([family, leads]) => {
    const present = new Set(leads.map((l) => l.stage));
    const total = leads.reduce((sum, l) => sum + leadValueNumber(l.value), 0);
    return {
      family,
      leads: leads.length,
      stages: STAGE_ORDER.filter((s) => present.has(s)),
      // 'en-US' pinned for the hydration reason the revenue chart documents.
      totalValue: `$${total.toLocaleString('en-US')}`,
      needsAttention: leads.some((l) => l.needsAttention === true),
    };
  });

  return groups.sort((a, b) =>
    a.needsAttention === b.needsAttention
      ? a.family.localeCompare(b.family)
      : a.needsAttention
        ? -1
        : 1,
  );
}
