// Shared contract for the trend line — see TrendLine.web.tsx / .native.tsx.
// SOT: docs/pack/27-reporting-charts-spec.md §4 (the suppression rule)
// SOT-KEYWORDS: trendline chart line sparkline series suppression contract
import type { Suppressible } from './DataTable';

/**
 * Doc 27 §4 types suppression at the contract level so it cannot be forgotten
 * at render time: a k-anonymity-suppressed point is NOT a zero and NOT a gap in
 * the data — it is a hole the chart must admit to.
 */
export interface TrendPoint {
  /** Category label for the x position — a month, a week, a date. */
  label: string;
  value: Suppressible<number>;
}

export interface TrendLineProps {
  data: readonly TrendPoint[];
  /** Names the series, so a single-series chart needs no legend box. */
  title: string;
  /** Formats the end label and any readout. */
  format?: (value: number) => string;
  /** Drawing height. Width always fills the container. */
  height?: number;
  className?: string;
}
