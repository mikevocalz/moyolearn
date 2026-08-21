'use client';
// One session, as a card (doc 08 §4.2).
// SOT: docs/pack/08-visual-hierarchy-spacing-spec.md §4.2 · docs/pack/02-adaptive-screens-design-spec.md §1
// SOT-KEYWORDS: schedulecard session card time mode chip budget actions schedule
import { tv, type VariantProps } from 'tailwind-variants';
import { Badge } from './Badge';
import { Button } from './Button';
import { Text, View } from './tw';

const card = tv({
  slots: {
    root: 'gap-element rounded-card border-2 border-border bg-surface-raised p-inset shadow-card',
    timeRow: 'flex-row items-center justify-between gap-element',
    time: 'font-mono text-data text-text',
    title: 'text-title text-text',
    meta: 'text-body text-text-muted',
    actions: 'flex-row flex-wrap gap-element pt-stack',
  },
  variants: {
    status: {
      default: {},
      // A session needing attention is marked, not alarmed: highlighter is the
      // attention accent, and redpen stays for a correction (doc 07 dignity rule).
      attention: { root: 'bg-highlighter/15' },
      overdue: { root: 'border-l-4 border-l-redpen' },
    },
  },
  defaultVariants: { status: 'default' },
});

export interface ScheduleCardProps extends VariantProps<typeof card> {
  /** Mono, always — a column of times has to align (doc 08 §3.1). */
  time: string;
  title: string;
  /**
   * At most TWO metadata rows. Doc 02 §1's content budget is enforced here in
   * the API rather than left to reviewers: a card that needs a third row is
   * describing L2 content, and the answer is a detail surface, not a taller card.
   */
  meta?: readonly [string] | readonly [string, string];
  /** Short chip at the end of the time row — "Virtual", "In person". */
  mode?: string;
  /** One primary and, at most, one secondary. Never a row of equal buttons. */
  primaryAction?: { label: string; onPress: () => void };
  secondaryAction?: { label: string; onPress: () => void };
  className?: string;
}

export function ScheduleCard({
  time,
  title,
  meta,
  mode,
  status,
  primaryAction,
  secondaryAction,
  className,
}: ScheduleCardProps) {
  const s = card({ status });
  return (
    <View className={s.root({ className })}>
      <View className={s.timeRow()}>
        <Text className={s.time()}>{time}</Text>
        {mode === undefined ? null : <Badge label={mode} />}
      </View>

      {/* Title after the time in the tree as well as visually: a screen reader
          hears when before who, which is the order the card is scanned in. */}
      <Text className={s.title()}>{title}</Text>

      {meta?.map((line) => (
        <Text key={line} className={s.meta()}>
          {line}
        </Text>
      ))}

      {primaryAction || secondaryAction ? (
        <View className={s.actions()}>
          {secondaryAction ? (
            <Button
              title={secondaryAction.label}
              variant="outline"
              size="sm"
              onPress={secondaryAction.onPress}
            />
          ) : null}
          {primaryAction ? (
            <Button title={primaryAction.label} size="sm" onPress={primaryAction.onPress} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
