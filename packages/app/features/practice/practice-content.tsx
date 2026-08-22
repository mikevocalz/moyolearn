'use client';
// Practice player — the rep machine, one item per screen.
//
// There is no Solve button anywhere in this file, by rule: R4 rejects jumping
// to answers, so the only path forward is the labelled ladder. Error voice is
// "Not yet", never "Wrong" or "Fail" (doc 04 §S10 Copy).
// SOT: docs/pack/04-screen-briefs.md §S10
// SOT-KEYWORDS: practice player item ladder hint check answer progress mastery

import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Button, Card, Heading, PressScale, Text, FadeIn } from '@acme/ui';
import { PRACTICE_ITEMS } from './practice.data';
import { usePracticeStore } from './practice.store';

export function PracticeContent() {
  const itemIndex = usePracticeStore((s) => s.itemIndex);
  const selectedChoice = usePracticeStore((s) => s.selectedChoice);
  const result = usePracticeStore((s) => s.result);
  const ladderDepth = usePracticeStore((s) => s.ladderDepth);
  const unaidedSolves = usePracticeStore((s) => s.unaidedSolves);
  const select = usePracticeStore((s) => s.select);
  const check = usePracticeStore((s) => s.check);
  const nextRung = usePracticeStore((s) => s.nextRung);
  const next = usePracticeStore((s) => s.next);
  const restart = usePracticeStore((s) => s.restart);

  const item = PRACTICE_ITEMS[itemIndex]!;
  const total = PRACTICE_ITEMS.length;
  const isLast = itemIndex === total - 1;
  const done = isLast && result === 'correct';
  const progress = Math.round(((itemIndex + (result === 'correct' ? 1 : 0)) / total) * 100);

  if (done) {
    return <SessionEnd unaided={unaidedSolves.length} total={total} onRestart={restart} />;
  }

  return (
    <View className="gap-7">
      {/* Progress is a filling ink bar — never a countdown, never a score. */}
      <FadeIn>
        <Section className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text variant="label" tone="muted">
              Question {itemIndex + 1} of {total}
            </Text>
          </View>
          <View
            accessibilityRole="progressbar"
            aria-label={`${progress} percent complete`}
            className="h-2 overflow-hidden rounded-full bg-surface-sunken"
          >
            <View className="h-full rounded-full bg-grade" style={{ width: `${progress}%` }} />
          </View>
        </Section>
      </FadeIn>

      <FadeIn delay={80}>
        <Heading level={1} size="display-sm" className="font-display text-3xl font-bold text-text">
          {item.prompt}
        </Heading>
      </FadeIn>

      <FadeIn delay={160}>
        <View className="gap-2">
          {item.choices.map((choice, index) => {
            const active = selectedChoice === index;
            return (
              <PressScale
                key={choice}
                className={`w-full min-h-11 rounded-card border-2 p-4 ${
                  active ? 'border-border bg-primary shadow-card' : 'border-border bg-surface-raised'
                }`}
                outerClassName="w-full"
                aria-label={choice}
                aria-selected={active}
                onPress={() => select(index)}
              >
                <TWText className={`text-base ${active ? 'font-semibold text-on-primary' : 'text-text'}`}>
                  {choice}
                </TWText>
              </PressScale>
            );
          })}
        </View>
      </FadeIn>

      {/* The ladder is visible so effort feels fair, not withheld. */}
      {ladderDepth > 0 ? (
        <FadeIn>
          <Card className="gap-2">
            {item.ladder.slice(0, ladderDepth).map((rung, index) => (
              <View key={rung} className="gap-1">
                <Text variant="caption" tone="muted">
                  Hint {index + 1} of {item.ladder.length}
                </Text>
                <TWText className="text-base text-text">{rung}</TWText>
              </View>
            ))}
          </Card>
        </FadeIn>
      ) : null}

      {result === 'retry' ? (
        <FadeIn>
          <Card className="gap-2 border-2 border-redpen/20 bg-redpen/5">
            <TWText className="text-base text-text">Not yet — look at it once more.</TWText>
          </Card>
        </FadeIn>
      ) : null}

      <View className="flex-row gap-2">
        {ladderDepth < item.ladder.length ? (
          <Button
            variant="outline"
            title={ladderDepth === 0 ? 'I need a hint' : 'Another hint'}
            onPress={nextRung}
          />
        ) : null}
        {result === 'correct' ? (
          <Button variant="primary" title="Next question" onPress={next} />
        ) : (
          <Button
            variant="primary"
            title={result === 'retry' ? 'Try again' : 'Check answer'}
            onPress={check}
            disabled={selectedChoice === null}
          />
        )}
      </View>
    </View>
  );
}

function SessionEnd({
  unaided,
  total,
  onRestart,
}: {
  unaided: number;
  total: number;
  onRestart: () => void;
}) {
  return (
    <FadeIn>
      <Card className="gap-4">
        <Heading level={1} size="display-sm" className="font-display text-3xl font-bold text-text">
          Nice work.
        </Heading>
        {/* Celebration is tuned to effort, and the praise names what actually
            happened — R3's unaided solves, spoken plainly. */}
        <TWText className="text-body text-text">
          {unaided > 0
            ? `You solved ${unaided} of ${total} on your own.`
            : 'You worked all the way through every question.'}
        </TWText>
        <Button variant="primary" title="Practice again" onPress={onRestart} />
      </Card>
    </FadeIn>
  );
}
