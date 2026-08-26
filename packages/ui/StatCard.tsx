'use client';
// A single number that matters (doc 08 §4.7).
// SOT: docs/pack/08-visual-hierarchy-spacing-spec.md §4.7
// SOT-KEYWORDS: statcard stat metric number kpi trend caption ops
import type { ReactNode } from 'react';
import { tv, type VariantProps } from './tv';
import { Text, View } from './primitives';

const stat = tv({
  slots: {
    root: 'gap-element rounded-card border-2 border-border bg-surface-raised p-inset shadow-card',
    // No font-size here on purpose — it lives in the `size` variant. Two custom
    // text-* tokens on one element do not resolve against each other in
    // tailwind-merge (neither is a known scale name), so both survive and the
    // stylesheet's order silently picks the winner.
    value: 'font-mono text-text',
    label: 'text-caption text-text-muted',
    trend: 'self-start rounded-sm px-2 py-0.5 font-mono text-caption font-semibold',
  },
  variants: {
    trendDirection: {
      up: { trend: 'bg-grade/15 text-grade' },
      down: { trend: 'bg-redpen/15 text-redpen' },
      flat: { trend: 'bg-surface-sunken text-text-muted' },
    },
    /*
      §4.7 offers `data-lg` OR `display-sm` for the number. `md` is the inline
      size that reads correctly beside body copy; `lg` is for a metric strip,
      where a 16px figure stops being the point of its own card. Default stays
      `md` so no existing card changes.
    */
    size: {
      md: { value: 'text-data-lg' },
      lg: { value: 'text-display-sm', root: 'p-inset-roomy' },
    },
  },
  defaultVariants: { trendDirection: 'flat', size: 'md' },
});

export interface StatCardProps extends VariantProps<typeof stat> {
  value: string;
  /** Sits BELOW the number, never above — the number is the point (§4.7). */
  label: string;
  /** Optional, and text not just an arrow: direction is never colour-only. */
  trend?: string;
  /**
   * Only when it disambiguates two otherwise identical cards. Icons as
   * decoration are the SaaS tell (§4.7), so this is deliberately not a default.
   */
  icon?: ReactNode;
  className?: string;
}

export function StatCard({ value, label, trend, trendDirection, size, icon, className }: StatCardProps) {
  const s = stat({ trendDirection, size });
  return (
    <View className={s.root({ className })}>
      {icon ? <View className="self-start">{icon}</View> : null}
      {/*
        Order is value → label in the tree as well as visually, so a screen
        reader hears the number first for the same reason the eye sees it first.
      */}
      <Text className={s.value()}>{value}</Text>
      <Text className={s.label()}>{label}</Text>
      {trend ? <Text className={s.trend()}>{trend}</Text> : null}
    </View>
  );
}
