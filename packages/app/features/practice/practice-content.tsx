'use client';
// `learner.stuff` — the hub is the screen, the player is a mode inside it.
//
// There is no Solve button anywhere in this file, by rule: R4 rejects jumping
// to answers, so the only path forward is the labelled ladder. Error voice is
// "Not yet", never "Wrong" or "Fail" (doc 04 §S10 Copy).
//
// The band is read once, here, and handed down: the hub picks WHICH maths a
// child sees and the player scales its targets and type to the same band, so
// the two halves can never disagree about who is holding the device. Missing
// band fails open to teen — the same idiom the tabs, the account sheet and
// profile use, so chrome and content agree until the band-population fix lands
// (A-repo-audit defect (a)).
// SOT: docs/pack/04-screen-briefs.md §S10 · design/screens/learner/learner.stuff/contract.md
// SOT-KEYWORDS: practice player item ladder hint check answer progress mastery hub band my stuff

import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Button, Card, Heading, PressScale, Text, FadeIn } from '@acme/ui';
import { useAppSession } from '../../providers/session';
import { bandScaleFor, type AgeBand } from '../capture/age-band';
import { practiceHubCopyFor, practiceSetById } from './practice.data';
import { PracticeHub } from './practice-hub';
import { usePracticeStore } from './practice.store';

export function PracticeContent() {
  const { activeContext, status } = useAppSession();
  const ageBand: AgeBand = activeContext.gradeBand ?? 'teen';
  const setId = usePracticeStore((s) => s.setId);

  if (setId === null) {
    return <PracticeHub ageBand={ageBand} loading={status === 'loading'} />;
  }
  return <PracticeSession ageBand={ageBand} setId={setId} />;
}

function PracticeSession({ ageBand, setId }: { ageBand: AgeBand; setId: string }) {
  const scale = bandScaleFor(ageBand);
  const copy = practiceHubCopyFor(ageBand);
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
  const leaveSet = usePracticeStore((s) => s.leaveSet);

  const set = practiceSetById(setId);
  const item = set?.items[itemIndex];
  // A set id with no set behind it means the band's content changed underneath
  // an open session (a profile switch on a family device). The hub is the honest
  // answer and costs nothing — never a blank screen, never a dead end (law 1).
  if (!set || !item) return <PracticeHub ageBand={ageBand} loading={false} />;

  const total = set.items.length;
  const isLast = itemIndex === total - 1;
  const progress = Math.round(((itemIndex + (result === 'correct' ? 1 : 0)) / total) * 100);

  if (isLast && result === 'correct') {
    return (
      <SessionEnd
        ageBand={ageBand}
        unaided={unaidedSolves.length}
        total={total}
        onAgain={restart}
        onBack={leaveSet}
      />
    );
  }

  return (
    <View className={scale.gap}>
      {/* Progress is a filling ink bar — never a countdown, never a score. */}
      <FadeIn>
        <Section className="gap-element">
          <View className="flex-row items-center justify-between gap-stack">
            <Text variant="label" tone="muted">
              {set.title}
            </Text>
            <PressScale
              className="min-h-target-adult justify-center rounded-md px-2"
              outerClassName="self-center"
              aria-label={copy.back}
              onPress={leaveSet}
            >
              <Text variant="caption" className="font-bold text-text underline">
                {copy.back}
              </Text>
            </PressScale>
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
        <Heading level={1} size={scale.title}>
          {item.prompt}
        </Heading>
      </FadeIn>

      <FadeIn delay={160}>
        <View className="gap-element">
          {item.choices.map((choice, index) => {
            const active = selectedChoice === index;
            return (
              <PressScale
                key={choice}
                className={`w-full justify-center rounded-card border-2 ${scale.target} ${scale.inset} ${
                  active ? 'border-border bg-primary shadow-card' : 'border-border bg-surface-raised'
                }`}
                outerClassName="w-full"
                aria-label={choice}
                aria-selected={active}
                onPress={() => select(index)}
              >
                <TWText
                  className={`${scale.rowTitle} ${active ? 'font-semibold text-on-primary' : 'text-text'}`}
                >
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
          <Card className="gap-element">
            {item.ladder.slice(0, ladderDepth).map((rung, index) => (
              <View key={rung} className="gap-1">
                <Text variant="caption" tone="muted">
                  Hint {index + 1} of {item.ladder.length}
                </Text>
                <TWText className={`text-text ${scale.rowTitle}`}>{rung}</TWText>
              </View>
            ))}
          </Card>
        </FadeIn>
      ) : null}

      {result === 'retry' ? (
        <FadeIn>
          <Card className="gap-element border-2 border-redpen/20 bg-redpen/5">
            <TWText className={`text-text ${scale.rowTitle}`}>Not yet — look at it once more.</TWText>
          </Card>
        </FadeIn>
      ) : null}

      <View className="flex-row flex-wrap gap-element">
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
  ageBand,
  unaided,
  total,
  onAgain,
  onBack,
}: {
  ageBand: AgeBand;
  unaided: number;
  total: number;
  onAgain: () => void;
  onBack: () => void;
}) {
  const scale = bandScaleFor(ageBand);
  const copy = practiceHubCopyFor(ageBand);
  return (
    <FadeIn>
      <Card className="gap-stack">
        <Heading level={1} size={scale.title}>
          Nice work.
        </Heading>
        {/* Celebration is tuned to effort, and the praise names what actually
            happened — R3's unaided solves, spoken plainly. It is a sentence
            about this session and never a running total to protect. */}
        <TWText className={`text-text ${scale.rowTitle}`}>
          {unaided > 0
            ? `You solved ${unaided} of ${total} on your own.`
            : 'You worked all the way through every question.'}
        </TWText>
        {/* Back to the hub is the primary: the contract's completion path is
            `self`, so finishing returns to My Stuff rather than looping. */}
        <Button variant="primary" title={copy.back} onPress={onBack} />
        <Button variant="outline" title={copy.again} onPress={onAgain} />
      </Card>
    </FadeIn>
  );
}
