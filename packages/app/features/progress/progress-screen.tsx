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

function masteryState(mastery: number): 'steady' | 'needs-attention' {
  return mastery < 0.5 ? 'needs-attention' : 'steady';
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <Heading level={4} className="text-text">{children}</Heading>
  );
}

export function ProgressScreen() {
  const { skillTitle, mastery, attempts, masteryBySkill } = useTutorStore();

  const practiced = Object.entries(masteryBySkill).map(([subject, value]) => ({
    subject,
    value: Math.round(value * 100),
    state: masteryState(value),
  }));

  const live =
    attempts > 0 && skillTitle && !masteryBySkill[skillTitle]
      ? [{ subject: `Live: ${skillTitle}`, value: Math.round(mastery * 100), state: masteryState(mastery) }]
      : [];

  const activeLower = skillTitle.toLowerCase();
  const practicedKeys = new Set(Object.keys(masteryBySkill).map((s) => s.toLowerCase()));
  const seeded = SEED.filter(
    ({ subject }) => !practicedKeys.has(subject.toLowerCase()) && subject.toLowerCase() !== activeLower,
  );

  return (
    <View className="flex-1 gap-stack p-inset">
      <View className="gap-group">
        <Heading level={2}>Your progress</Heading>
        <Text className="font-sans text-body text-text-muted">
          The bars show what you have mastered so far. The seeded data keeps the demo useful.
        </Text>
      </View>
      <View className="gap-stack">
        {live.length > 0 ? (
          <View className="gap-group">
            <SectionHeading>This session</SectionHeading>
            {live.map(({ subject, value, state }) => (
              <MasteryBar key={subject} label={subject} value={value} state={state} />
            ))}
          </View>
        ) : null}
        {practiced.length > 0 ? (
          <View className="gap-group">
            <SectionHeading>Practiced</SectionHeading>
            {practiced.map(({ subject, value, state }) => (
              <MasteryBar key={subject} label={subject} value={value} state={state} />
            ))}
          </View>
        ) : null}
        {seeded.length > 0 ? (
          <View className="gap-group">
            <SectionHeading>More to explore</SectionHeading>
            {seeded.map(({ subject, value, state }) => (
              <MasteryBar key={subject} label={subject} value={value} state={state} />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}
