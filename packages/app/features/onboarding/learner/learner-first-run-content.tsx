'use client';
// S22 · Learner first-run — the tutor says hello, the child picks what they came
// for, and answers one question they can actually get right. Under two minutes,
// zero forms: doc 06 §5 gives this screen no text input at all, so every gate on
// the step machine is satisfiable by tapping.
//
// Mobbin: https://mobbin.com/flows/63b774b7-a199-4a57-8bee-54ec27c551a4
// (Duolingo ABC onboarding — a thin progress bar with the back arrow beside it on
// every step but the first, and a grid of oversized tap-once tiles with no confirm
// step) · https://mobbin.com/flows/7ffbd4f0-78d1-49be-bf0d-9c90cac00e8c (Brilliant
// onboarding — the mascot asks each question from a speech bubble beside it, so the
// character is the interface rather than a decoration above the copy) ·
// https://mobbin.com/flows/5df9112e-cba3-41a0-bad1-cf6ea08161e6 (Nibble onboarding —
// the selection cap is stated above the list, not discovered by hitting it) ·
// https://mobbin.com/flows/b558f09a-f3ae-422d-98c6-ad93bc0f49e5 (Replika character
// selection — the character holds the whole first frame with one action under it).
// Structure only; style stays on docs 02/08.
// SOT: docs/pack/06-auth-onboarding-spec.md §5
// SOT-KEYWORDS: onboarding learner s22 first-run hello subjects tiny win screen

import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Avatar, Button, Dial, FadeIn, Heading, MessageBubble, PressScale, ScaleIn, Text } from '@acme/ui';
import { useLearnerFirstRun } from './store';
import {
  canAdvance,
  nextStep,
  previousStep,
  stepProgress,
  winItem,
  MAX_SUBJECTS,
  SUBJECT_TILES,
} from './steps';

export function LearnerFirstRunContent({ onDone }: { onDone: () => void }) {
  const { step, draft, setStep, toggle } = useLearnerFirstRun();
  const { index, total } = stepProgress(step);
  const back = previousStep(step);
  const forward = nextStep(step);
  const ready = canAdvance(step, draft);
  const name = draft.firstName || 'there';

  return (
    <Dial temperature="hot">
      <View className="gap-group">
        {/* Duolingo ABC: back arrow beside the bar, never a step counter a child
            has to read. The bar is the whole status display. */}
        <FadeIn>
          <View className="flex-row items-center gap-element">
            {back ? (
              <Button variant="ghost" size="sm" title="Back" onPress={() => setStep(back)} />
            ) : null}
            <View
              accessibilityRole="progressbar"
              aria-label={`Step ${index} of ${total}`}
              className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunken"
            >
              <View
                className="h-full rounded-full bg-grade"
                style={{ width: `${Math.round((index / total) * 100)}%` }}
              />
            </View>
          </View>
        </FadeIn>

        {step === 'hello' ? (
          <Section className="items-center gap-group">
            {/* Replika gives the character the frame and puts one action under it.
                The tutor IS the screen here (doc 06 §5's "full hot dial"). */}
            <Avatar name="Moyo" size="xl" />
            <MessageBubble from="tutor">
              Hi {name}. I&apos;m Moyo, and I help you with schoolwork. Tell me what you&apos;re
              working on and we&apos;ll do one together right now.
            </MessageBubble>
            <Button
              size="lg"
              title="Hi Moyo"
              className="min-h-target-child w-full"
              onPress={() => forward && setStep(forward)}
            />
          </Section>
        ) : null}

        {step === 'subjects' ? (
          <Section className="gap-group">
            <Heading level={1} size="display-sm" className="font-display text-3xl font-bold text-text">
              What are you working on?
            </Heading>
            {/* Nibble states the cap above the list. Discovering it by tapping a
                fourth tile and having nothing happen reads as a broken screen. */}
            <Text variant="label" tone="muted">
              Pick up to {MAX_SUBJECTS}. You can change this later.
            </Text>
            <View className="flex-row flex-wrap gap-stack">
              {SUBJECT_TILES.map((tile) => {
                const picked = draft.subjects.includes(tile.id);
                const full = draft.subjects.length >= MAX_SUBJECTS && !picked;
                return (
                  <PressScale
                    key={tile.id}
                    onPress={() => toggle(tile.id)}
                    aria-disabled={full}
                    accessibilityState={{ selected: picked, disabled: full }}
                    className={[
                      'min-w-36 min-h-target-young flex-1 basis-[45%] rounded-card border-2 p-inset',
                      picked ? 'border-strong bg-highlighter' : 'border-border bg-surface-raised',
                      full ? 'opacity-50' : '',
                    ].join(' ')}
                  >
                    <TWText className="font-display text-body-lg font-bold text-text">
                      {tile.label}
                    </TWText>
                    <TWText className="text-caption text-text-muted">{tile.hint}</TWText>
                  </PressScale>
                );
              })}
            </View>
            <Button
              size="lg"
              title="That's it"
              disabled={!ready}
              className="min-h-target-child w-full"
              onPress={() => forward && setStep(forward)}
            />
          </Section>
        ) : null}

        {step === 'win' ? <Win onDone={onDone} /> : null}
      </View>
    </Dial>
  );
}

/**
 * The tiny win. One question, drawn from the first subject they tapped, so the
 * first thing they get right is the thing they came for. A wrong tap answers
 * again — no lockout, no score, and the copy is "Not yet" (doc 04 §S10).
 */
function Win({ onDone }: { onDone: () => void }) {
  const draft = useLearnerFirstRun((s) => s.draft);
  const answer = useLearnerFirstRun((s) => s.answer);
  const item = winItem(draft);
  const solved = draft.result === 'correct';

  if (solved) {
    return (
      <Section className="items-center gap-group">
        {/* The ink stamp. ScaleIn is the kit's confirmation-moment entrance and
            now reads Reduce Motion itself, so this lands as a still seal on a
            device that asked for one — doc 06 §5 keeps the reward, drops the
            movement. */}
        <ScaleIn>
          <View className="items-center justify-center rounded-full border-2 border-strong bg-grade p-inset-roomy">
            <TWText className="font-display text-3xl font-bold text-text">✓</TWText>
          </View>
        </ScaleIn>
        <MessageBubble from="tutor">
          That&apos;s it. That&apos;s how this works — you try, I help, you get there. Ready when
          you are.
        </MessageBubble>
        <Button size="lg" title="Let's go" className="min-h-target-child w-full" onPress={onDone} />
      </Section>
    );
  }

  return (
    <Section className="gap-group">
      {/* Brilliant puts the question in the mascot's bubble; the child is being
          asked by someone, not by a form. */}
      <MessageBubble from="tutor">{item.prompt}</MessageBubble>
      <View className="gap-stack">
        {item.choices.map((choice, i) => (
          <PressScale
            key={choice}
            onPress={() => answer(i)}
            className="min-h-target-child rounded-card border-2 border-border bg-surface-raised p-inset"
          >
            <TWText className="font-sans text-body-lg text-text">{choice}</TWText>
          </PressScale>
        ))}
      </View>
      {draft.result === 'not-yet' ? (
        <FadeIn>
          <Text variant="label" tone="muted">
            {item.notYet}
          </Text>
        </FadeIn>
      ) : null}
    </Section>
  );
}
