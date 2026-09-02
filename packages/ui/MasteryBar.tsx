'use client';
// Mastery progress for a learner (doc 08 §4.8).
// SOT: docs/pack/08-visual-hierarchy-spacing-spec.md §4.8 · docs/pack/07-security-child-ai-safety-spec.md
// SOT-KEYWORDS: mastery bar progress learner grade highlighter dignity attention
import { tv, type VariantProps } from './tv';
import { Pressable, Text, View } from './primitives';

const bar = tv({
  slots: {
    root: 'gap-element',
    track: 'w-full overflow-hidden rounded-full bg-ink-950/12 dark:bg-ink-50/12',
    fill: 'h-full rounded-full',
    value: 'font-mono text-data text-text',
  },
  variants: {
    /*
      `needs-attention` is HIGHLIGHTER, not redpen — and this is a child-outcome
      rule, not a palette preference. In a school-supplies language red pen means
      "marked wrong", and a child's overall progress is never wrong (doc 07's
      dignity rule, doc 08 §4.8 makes it a colour spec). redpen stays for marking
      a specific answer; it must never describe the child.
    */
    state: {
      steady: { fill: 'bg-grade' },
      'needs-attention': { fill: 'bg-highlighter' },
    },
    size: {
      // Below 24px the value label cannot sit inside the bar (§4.8), so both
      // sizes place it adjacent and the track stays purely a track.
      sm: { track: 'h-2' },
      md: { track: 'h-3' },
    },
    /*
      Band-aware sizing (doc 08 §2.4 — token doc "Open token work" item 3).
      The band comes from the signed-in learner's profile — the same source the
      learner tab bar's BAND_TARGET map reads — and, being declared after
      `size`, its track height wins the merge when both are set. The root
      consumes the band's target token because with `onPress` the whole bar is
      a practice shortcut: a K–2 shortcut must CLEAR the 72px target, not just
      look chunky. Optional with no default, so existing call sites keep md.
    */
    band: {
      young: { root: 'min-h-target-young justify-center', track: 'h-5' },
      child: { root: 'min-h-target-child justify-center', track: 'h-4' },
      teen: { root: 'min-h-target-teen justify-center', track: 'h-3' },
      adult: { root: 'min-h-target-adult justify-center', track: 'h-2' },
    },
  },
  defaultVariants: { state: 'steady', size: 'md' },
});

export interface MasteryBarProps extends VariantProps<typeof bar> {
  /** 0–100. Clamped, because a projection that briefly exceeds 100 is a bug, not a UI state. */
  value: number;
  /** What is being mastered — required, so the bar is never an unlabelled figure. */
  label: string;
  showValue?: boolean;
  className?: string;
  /** When present, the entire bar becomes a practice shortcut. */
  onPress?: () => void;
}

export function MasteryBar({ value, label, state, size, band, showValue = true, className, onPress }: MasteryBarProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const { root, track, fill, value: valueText } = bar({ state, size, band });
  const Root = onPress ? Pressable : View;

  return (
    <Root
      onPress={onPress}
      className={root({ className })}
      accessibilityRole={onPress ? 'button' : 'progressbar'}
      accessibilityLabel={label}
      accessibilityValue={onPress ? undefined : { min: 0, max: 100, now: pct }}
    >
      <View className="flex-row items-center justify-between gap-element">
        <Text className="text-label text-text">{label}</Text>
        {showValue ? <Text className={valueText()}>{pct}%</Text> : null}
      </View>
      {/*
        Reported to assistive tech as a progressbar with its real bounds. Colour
        alone never carries the state (WCAG 1.4.1) — the adjacent value and the
        label do, which is also why showValue defaults on.
      */}
      <View
        className={track()}
      >
        <View className={fill()} style={{ width: `${pct}%` }} />
      </View>
    </Root>
  );
}
