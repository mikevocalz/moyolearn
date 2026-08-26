'use client';
// ProgressScreen — pre-seeded mastery view so the demo never lands on an empty chart.
// SOT: docs/pack/19-learning-outcomes-spec.md §3 · docs/pack/22-reporting-charts-spec.md §2
// SOT-KEYWORDS: progress screen mastery chart pre-seeded learner subject

import { MasteryBar, Heading, Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { useTutorStore } from '@acme/app';

const SEED = [
  { subject: 'Number sense', value: 72 },
  { subject: 'Operations', value: 45, state: 'needs-attention' as const },
  { subject: 'Fractions', value: 60 },
  { subject: 'Word problems', value: 34, state: 'needs-attention' as const },
];

export function ProgressScreen() {
  const { skillTitle, mastery, attempts } = useTutorStore();

  return (
    <View className="flex-1 gap-stack p-inset">
      <View className="gap-group">
        <Heading level={2}>Your progress</Heading>
        <Text className="font-sans text-body text-text-muted">
          The bars show what you have mastered so far. The seeded data keeps the demo useful.
        </Text>
      </View>
      <View className="gap-stack">
        {attempts > 0 && skillTitle ? (
          <MasteryBar
            label={`Live: ${skillTitle}`}
            value={Math.round(mastery * 100)}
            state={mastery < 0.5 ? 'needs-attention' : 'steady'}
          />
        ) : null}
        {SEED.map(({ subject, value, state }) => (
          <MasteryBar key={subject} label={subject} value={value} state={state} />
        ))}
      </View>
    </View>
  );
}
