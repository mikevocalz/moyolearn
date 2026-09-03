'use client';
// ProgressScreen — persisted mastery view with live practice integration.
// Mobbin: https://mobbin.com/screens/fc220106-b147-4b55-b43b-7d231d1b9a54 (Mindvalley — skill rows grouped
// in one bounded card under a small section title) · https://mobbin.com/screens/4049eb3f-4010-41bf-b385-75ca29eae9f3
// (Noom — one display moment, then section labels clearly subordinate to it) ·
// https://mobbin.com/screens/26e848ed-2272-470d-8a78-8444b98e79eb (Ahead — the metric sits next to its
// label, not at the far edge of the row). Structure only: the measure cap, the heading step-down, and
// the row rhythm.
// SOT: docs/pack/19-learning-outcomes-spec.md §3 · docs/pack/22-reporting-charts-spec.md §2
// SOT-KEYWORDS: progress screen mastery chart learner persisted live review scaffolding

import { useRouter } from 'solito/navigation';
import { MasteryBar, Heading, Text, Container } from '@acme/ui';
import { ScrollView } from '@acme/ui/tw';
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

/**
 * `Heading` sizes from its `size` variant, not its `level` — level is the tag.
 * Both this and the page title were rendering at the default `display-md`, so
 * "Your progress", "Practiced" and "More to explore" came out identical and the
 * page had no hierarchy at all. One display moment per screen (CLAUDE.md §UI):
 * the title keeps it, sections step down to `title`.
 */
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <Heading level={3} size="title" className="text-text">{children}</Heading>
  );
}

export function ProgressScreen() {
  const router = useRouter();
  const { setProblem } = useCaptureStore();
  const { skillTitle, mastery, attempts } = useTutorStore();
  const { masteryBySkill, reviewBySkill, scaffoldingBySkill, loading, error } = useProgress(attempts);

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
    <View className="flex-1 bg-surface">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Container width="detail" className="py-4 pb-48 gap-section">
          <View className="gap-stack">
            <Heading level={1} size="display-lg">Your progress</Heading>
            {/*
              THREE ANSWERS, NOT TWO.

              `useProgress` has always returned `error` and this line has always
              ignored it, so a failed mastery load fell through to "The bars show
              what you have mastered so far" — a sentence pointing at numbers
              that had not arrived. On a screen whose whole subject is what a
              child has actually learned, describing stale or absent data as
              their mastery is the one thing it must not do.

              No redpen and no apology theatre: doc 08 keeps redpen off a
              struggling learner, and the failure is ours to state plainly.
            */}
            <Text className="font-sans text-body text-text-muted">
              {loading
                ? 'Loading your mastery...'
                : error
                  ? "Your latest mastery didn't load just now. What's below may be out of date."
                  : 'The bars show what you have mastered so far.'}
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
        </Container>
      </ScrollView>
    </View>
  );
}
