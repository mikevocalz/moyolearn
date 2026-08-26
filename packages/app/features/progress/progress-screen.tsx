'use client';
// ProgressScreen — persisted mastery view with live practice integration.
// SOT: docs/pack/19-learning-outcomes-spec.md §3 · docs/pack/22-reporting-charts-spec.md §2
// SOT-KEYWORDS: progress screen mastery chart learner persisted live review scaffolding

import { useRouter } from 'solito/navigation';
import { MasteryBar, Heading, Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { useTutorStore, useCaptureStore } from '@acme/app';
import { generatePracticeProblem } from '@acme/student-model/pure';
import { useProgress } from './use-progress';

const SEED = [
  { subject: 'Number sense', value: 72 },
  { subject: 'Order of operations', value: 45, state: 'needs-attention' as const },
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
  const router = useRouter();
  const { setProblem } = useCaptureStore();
  const { skillTitle, mastery, attempts } = useTutorStore();
  const { masteryBySkill, reviewBySkill, scaffoldingBySkill, loading } = useProgress(attempts);

  const handlePractice = (subject: string) => {
    const problem = generatePracticeProblem(subject);
    if (!problem) return;
    setProblem(problem);
    router.push('/tutor');
  };

  const liveOnPress = skillTitle && generatePracticeProblem(skillTitle)
    ? () => handlePractice(skillTitle)
    : undefined;
  const live =
    attempts > 0 && skillTitle
      ? [{ subject: `Live: ${skillTitle}`, value: Math.round(mastery * 100), state: masteryState(mastery), onPress: liveOnPress }]
      : [];

  const activeLower = (skillTitle ?? '').toLowerCase();
  const practiced = Object.entries(masteryBySkill)
    .filter(([subject]) => subject.toLowerCase() !== activeLower)
    .map(([subject, value]) => ({
      subject,
      value: Math.round(value * 100),
      state: masteryState(value),
      onPress: generatePracticeProblem(subject) ? () => handlePractice(subject) : undefined,
    }));

  const practicedKeys = new Set(Object.keys(masteryBySkill).map((s) => s.toLowerCase()));
  const seeded = SEED.filter(
    ({ subject }) => !practicedKeys.has(subject.toLowerCase()) && subject.toLowerCase() !== activeLower,
  );

  const reviews = Object.entries(reviewBySkill).map(([subject, dueAt]) => ({
    subject,
    dueAt: new Date(dueAt).toLocaleDateString(),
    onPress: generatePracticeProblem(subject) ? () => handlePractice(subject) : undefined,
  }));

  const scaffolds = Object.entries(scaffoldingBySkill).map(([subject, hintDepth]) => ({
    subject,
    value: Math.min(Math.round(hintDepth * 25), 100),
    state: 'steady' as const,
    onPress: generatePracticeProblem(subject) ? () => handlePractice(subject) : undefined,
  }));

  return (
    <View className="flex-1 gap-stack p-inset">
      <View className="gap-group">
        <Heading level={2}>Your progress</Heading>
        <Text className="font-sans text-body text-text-muted">
          {loading ? 'Loading your mastery...' : 'The bars show what you have mastered so far.'}
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
            {practiced.map(({ subject, value, state, onPress }) => (
              <MasteryBar key={subject} label={subject} value={value} state={state} onPress={onPress} />
            ))}
          </View>
        ) : null}
        {seeded.length > 0 ? (
          <View className="gap-group">
            <SectionHeading>More to explore</SectionHeading>
            {seeded.map(({ subject, value, state }) => {
              const onPress = generatePracticeProblem(subject) ? () => handlePractice(subject) : undefined;
              return (
                <MasteryBar
                  key={subject}
                  label={subject}
                  value={value}
                  state={state}
                  onPress={onPress}
                />
              );
            })}
          </View>
        ) : null}
        {reviews.length > 0 ? (
          <View className="gap-group">
            <SectionHeading>Coming up for review</SectionHeading>
            {reviews.map(({ subject, dueAt }) => (
              <View key={subject} className="flex-row justify-between">
                <Text className="font-sans text-body text-text">{subject}</Text>
                <Text className="font-sans text-body text-text-muted">{dueAt}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {scaffolds.length > 0 ? (
          <View className="gap-group">
            <SectionHeading>Scaffolding</SectionHeading>
            {scaffolds.map(({ subject, value, onPress }) => (
              <MasteryBar key={subject} label={subject} value={value} state="steady" onPress={onPress} />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}
