// The dashboard's headline figures, as a pure function of the pipeline.
//
// Deliberately NOT in `ops.service.ts` and deliberately without `server-only`,
// for the same reason `stage-change.ts` sits outside it: this is arithmetic with
// a judgement call in it, and arithmetic with a judgement call in it is the part
// that earns a test. A module the test runner cannot import is a module nobody
// checks.
// SOT: docs/pack/28-crm-spec.md §3 (pipeline) · §7 (reporting)
// SOT-KEYWORDS: ops stats conversion sessions attention aggregate pipeline pure
import type { Lead } from './ops.data.ts';

export interface LeadStats {
  /** Families waiting on a human decision. */
  needsAttention: number;
  /** Sessions delivered across the pipeline — the sum, not a guess. */
  sessionsDelivered: number;
  /**
   * Trials that became enrolments, as a percentage of trials that CONCLUDED.
   * Absent when nobody has finished a trial yet: 0% would read as "we convert
   * nobody" when the truth is "no one has finished one".
   */
  trialConversionPct?: number;
}

/**
 * Always computed over EVERY row in the org, never the visible page: a figure
 * that changes when you filter the table or turn to page two is not a figure
 * about the business.
 *
 * Conversion counts concluded trials only. Using every lead as the denominator
 * would mean a healthy month of new inquiries dragged the rate down — the number
 * would fall precisely when the business was doing well, and a metric that moves
 * the wrong way is one nobody trusts twice.
 */
export function statsFor(rows: readonly Lead[]): LeadStats {
  const concluded = rows.filter(
    (l) => l.stage === 'Trial completed' || l.stage === 'Proposal' || l.stage === 'Enrolled',
  ).length;
  const enrolled = rows.filter((l) => l.stage === 'Enrolled').length;
  return {
    needsAttention: rows.filter((l) => l.needsAttention).length,
    sessionsDelivered: rows.reduce((sum, l) => sum + l.sessions, 0),
    trialConversionPct: concluded > 0 ? Math.round((enrolled / concluded) * 100) : undefined,
  };
}
