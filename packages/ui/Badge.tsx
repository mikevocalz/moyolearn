import { tv, type VariantProps } from './tv';
import { View, Text } from './primitives';

const badge = tv({
  slots: {
    root: 'flex-row items-center gap-1 self-start rounded-sm border-2 border-border px-2.5 py-0.5',
    label: 'text-xs font-bold',
  },
  variants: {
    tone: {
      neutral: { root: 'bg-surface-sunken', label: 'text-text-muted' },
      primary: { root: 'bg-burgundy-100 dark:bg-burgundy-900/60', label: 'text-burgundy-800 dark:text-burgundy-100' },
      accent: { root: 'bg-ember-100 dark:bg-ember-900/40', label: 'text-ember-800 dark:text-ember-100' },
      // `success` was mapped to the ember (hot pink) scale — a copy of `accent`
      // one step lighter, so every "Enrolled"/"Paid"/"Active" badge in the
      // product rendered pink. Success is the grade mark: forest.
      success: { root: 'bg-forest-50 dark:bg-forest-900/40', label: 'text-forest-700 dark:text-forest-200' },
      /*
        The needs-attention tone (doc 08 §4.8). Highlighter, never redpen: red
        pen means "marked wrong", and neither a learner's progress nor a family
        relationship going quiet is a thing anyone got wrong. Ink on highlighter
        measures 14.4:1, which is why this is the one tone that fills.
      */
      attention: { root: 'bg-highlighter', label: 'text-on-highlighter' },
      inverse: { root: 'bg-ink-50/15', label: 'text-ink-50' },
      danger: { root: 'bg-danger', label: 'text-on-danger' },
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export interface BadgeProps extends VariantProps<typeof badge> {
  label: string;
  className?: string;
}

export function Badge({ label, tone, className }: BadgeProps) {
  const { root, label: labelCls } = badge({ tone });
  return (
    <View className={root({ className })}>
      <Text className={labelCls()}>{label}</Text>
    </View>
  );
}

