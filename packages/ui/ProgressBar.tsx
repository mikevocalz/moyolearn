'use client';
// Transfer progress (doc 08 §4.8 anatomy · doc 29 §7): track ink @ 12%, fill
// grade-green, failure in redpen, value label in `data` mono ADJACENT to the
// bar, never inside it below 24px. Distinct from MasteryBar on purpose:
// MasteryBar describes a child and is forbidden redpen by the dignity rule —
// a failed upload genuinely IS an error, so it needs the state MasteryBar must
// never have. Composing them would put "failed" one prop away from a learner.
// Mobbin: https://mobbin.com/screens/2a7be71f-2e9a-404c-9c56-c846d8616783 (Revolut Business — per-file bar with adjacent percentage) · https://mobbin.com/screens/12f6528d-e78a-4540-9087-784c0baa9172 (Proton Drive — per-file speed and % beside each row's bar) · https://mobbin.com/screens/db5924ed-04c5-4ea2-a20c-bd81cf0917bc (Supabase — one bar per batch is the anti-pattern; this component exists so every file gets its own). Structure only.
// SOT: docs/pack/29-bunny-media-spec.md §7 · docs/pack/08-visual-hierarchy-spacing-spec.md §4.8
// SOT-KEYWORDS: progress bar upload transfer determinate indeterminate redpen grade
import { tv, type VariantProps } from './tv';
import { Text, View } from './primitives';

const bar = tv({
  slots: {
    root: 'flex-row items-center gap-element',
    track: 'h-2 flex-1 overflow-hidden rounded-full bg-ink-950/12 dark:bg-ink-50/12',
    fill: 'h-full rounded-full',
    value: 'font-mono text-data text-text-muted',
  },
  variants: {
    tone: {
      steady: { fill: 'bg-grade' },
      failed: { fill: 'bg-redpen' },
    },
    /*
      Band-aware sizing (doc 08 §2.4 — token doc "Open token work" item 3).
      The band comes from the signed-in learner's profile — the same source the
      learner tab bar's BAND_TARGET map reads — never from the component. The
      root consumes the band's target token so the row sits at the band's height
      in a learner list (a child watching their homework photo upload), and the
      track thickens to stay legible at that scale. `adult` maps to
      target-adult (44), not the tab bar's teen bump: that bump is an Android
      tab preference, and this is a row height. Optional with no default, so
      every existing call site keeps today's compact h-2.
    */
    band: {
      young: { root: 'min-h-target-young', track: 'h-5' },
      child: { root: 'min-h-target-child', track: 'h-4' },
      teen: { root: 'min-h-target-teen', track: 'h-3' },
      adult: { root: 'min-h-target-adult', track: 'h-2' },
    },
  },
  defaultVariants: { tone: 'steady' },
});

export interface ProgressBarProps extends VariantProps<typeof bar> {
  /**
   * 0–1, or null for indeterminate — a total the transport has not reported
   * yet. Indeterminate renders a partial fill at reduced opacity rather than
   * an animation: an honest "moving, amount unknown" (doc 29 §4 phase 2).
   */
  ratio: number | null;
  /** What is moving — required, so the bar is never an unlabelled figure. */
  label: string;
  /** Adjacent value text (`42%`, `1.2 MB / 4 MB`). Omitted when null. */
  valueText?: string | null;
  className?: string;
}

export function ProgressBar({ ratio, label, valueText, tone, band, className }: ProgressBarProps) {
  const s = bar({ tone, band });
  const clamped = ratio === null ? null : Math.max(0, Math.min(1, ratio));
  return (
    <View
      role="progressbar"
      aria-label={label}
      accessibilityLabel={label}
      aria-valuenow={clamped === null ? undefined : Math.round(clamped * 100)}
      accessibilityValue={
        clamped === null ? undefined : { min: 0, max: 100, now: Math.round(clamped * 100) }
      }
      className={s.root({ className })}
    >
      <View className={s.track()}>
        <View
          className={`${s.fill()} ${clamped === null ? 'w-1/3 opacity-50' : ''}`}
          style={clamped === null ? undefined : { width: `${clamped * 100}%` }}
        />
      </View>
      {valueText ? <Text className={s.value()}>{valueText}</Text> : null}
    </View>
  );
}
