// The movement meter's geometry and copy, shared by the web (GSAP) and native
// (Reanimated) renderers so both draw the same bar from the same numbers.
// SOT: DIRECTION.md §Signatures S1 · docs/pack/34-session-summary-reports.md
// SOT-KEYWORDS: movement meter geometry before after gain percent shared
export interface MovementMeterProps {
  /** The skill in parent language; the meter's accessible name. */
  label: string;
  /** Raw estimates, 0-1, before and after this session. */
  beforeP: number;
  afterP: number;
  state: 'steady' | 'needs-attention';
  /** "Developing → Proficient": the level change, shown as a data line. */
  levelLine: string;
  /** Doc 34 §2.4's grade-position sentence, the second axis. */
  positionCopy: string;
}

const pct = (p: number) => Math.max(0, Math.min(100, Math.round(p * 100)));

/**
 * Percentages for the two fills. When the session did not raise the estimate
 * there is no growth to animate: `gain` is 0 and the caller draws the after
 * fill at full strength, so the bar reads as finished, not half-drawn. Any
 * level change, up or down, is stated by `levelLine`.
 */
export function meterGeometry(beforeP: number, afterP: number) {
  const before = pct(beforeP);
  const after = pct(afterP);
  const gain = Math.max(0, after - before);
  return { after, base: gain > 0 ? before : after, gain };
}

// Same track, fills and type as MasteryBar (packages/ui/MasteryBar.tsx), so the
// report reads as the kit; the base fill is the gain colour at half strength.
export const METER_CLASS = {
  root: 'gap-element',
  track: 'relative h-3 w-full overflow-hidden rounded-full bg-ink-950/12 dark:bg-ink-50/12',
  base: 'absolute inset-y-0 left-0 rounded-l-full',
  /** The fill when nothing grew: the whole bar, full strength, rounded both ends. */
  settledBase: 'absolute inset-y-0 left-0 rounded-full',
  value: 'font-mono text-data text-text',
  fill: {
    steady: { base: 'bg-grade/50', solid: 'bg-grade', gain: 'h-full w-full bg-grade' },
    'needs-attention': { base: 'bg-highlighter/50', solid: 'bg-highlighter', gain: 'h-full w-full bg-highlighter' },
  },
} as const;
