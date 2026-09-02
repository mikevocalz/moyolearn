'use client';
// S22 · Learner first-run — the tutor says hello, the child picks what they came
// for, answers one question they can actually get right, and is invited into
// their first Snap. Under two minutes, zero forms: doc 06 §5 gives this screen
// no text input at all, so every gate on the step machine is satisfiable by
// tapping. Naming law (docs 32/37): MOYO is the product, NATALIE is the tutor —
// the character on this screen is Natalie, everywhere, or the child meets two
// strangers in one minute.
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

import { useStore } from 'zustand';
import { Section, View, Text as TWText } from '@acme/ui/tw';
import {
  Avatar,
  Button,
  Dial,
  FadeIn,
  Heading,
  MessageBubble,
  PressScale,
  ScaleIn,
  Text,
  AudioPlayer,
  useInstanceStore,
} from '@acme/ui';
import { useLearnerFirstRun } from './store';
import {
  canAdvance,
  nextStep,
  previousStep,
  stepProgress,
  winItem,
  AVATAR_CHOICES,
  MAX_SUBJECTS,
  SUBJECT_TILES,
} from './steps';
import { API_URL } from '../../../core/api-url.ts';

type GreetingAudio = { phase: 'idle' } | { phase: 'loading' } | { phase: 'ready'; uri: string } | { phase: 'silent' };

export interface LearnerFirstRunProps {
  onDone: () => void;
  /** Routes into the real capture flow — the snap step teaches at the camera, it never carries one. */
  onTrySnap: () => void;
}

export function LearnerFirstRunContent({ onDone, onTrySnap }: LearnerFirstRunProps) {
  const { step, draft, setStep, toggle, pickAvatar } = useLearnerFirstRun();
  /*
    Doc 32 Path B: the greeting is a BAKED piece — cached audio behind a signed
    URL, never a live TTS call in front of a waiting child. Fetched on tap, and
    every failure is 'silent': the same words are already on screen, so a miss
    costs nothing and reports nothing.
  */
  const greetingStore = useInstanceStore<GreetingAudio>(() => ({ phase: 'idle' }));
  const greeting = useStore(greetingStore);
  const hearGreeting = async () => {
    greetingStore.setState({ phase: 'loading' });
    try {
      const res = await fetch(`${API_URL}/api/tutor/voice/baked/greeting-first`, {
        credentials: 'include',
      });
      if (!res.ok || res.status === 204) {
        greetingStore.setState({ phase: 'silent' });
        return;
      }
      const data = (await res.json()) as { url?: string };
      greetingStore.setState(data.url ? { phase: 'ready', uri: data.url } : { phase: 'silent' });
    } catch {
      greetingStore.setState({ phase: 'silent' });
    }
  };
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
            {/* A child's target comes from the age band (doc 08 §2.4), so the
                kit's 44 default is the wrong one on this screen. */}
            {back ? (
              <Button variant="ghost" size="xl" title="Back" onPress={() => setStep(back)} />
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

        {step === 'avatar' ? (
          <Section className="gap-group">
            <MessageBubble from="tutor">Pick your buddy, {name}! They&apos;ll learn with you.</MessageBubble>
            {/* Curated set only (doc 30 §8.4): no camera, no library, no upload
                path in the UI at all — one tap picks, tapping another re-picks,
                so a mis-tap is recoverable without an undo concept. */}
            <View className="flex-row flex-wrap gap-stack">
              {AVATAR_CHOICES.map((choice) => {
                const picked = draft.avatar === choice.id;
                return (
                  <PressScale
                    key={choice.id}
                    aria-label={choice.label}
                    aria-selected={picked}
                    onPress={() => pickAvatar(choice.id)}
                    className={`min-h-target-young min-w-28 flex-1 items-center gap-1 rounded-card border-2 p-inset ${
                      picked
                        ? 'border-border bg-primary shadow-card'
                        : 'border-border bg-surface'
                    }`}
                  >
                    <TWText className="text-4xl">{choice.glyph}</TWText>
                    <TWText
                      className={`text-label font-semibold ${picked ? 'text-on-primary' : 'text-text'}`}
                    >
                      {choice.label}
                    </TWText>
                  </PressScale>
                );
              })}
            </View>
          </Section>
        ) : null}

        {step === 'hello' ? (
          <Section className="items-center gap-group">
            {/* Replika gives the character the frame and puts one action under it.
                The tutor IS the screen here (doc 06 §5's "full hot dial"). */}
            <Avatar name="Natalie" size="xl" />
            {/* The bubble IS the caption (doc 37 §2 "captioned always"): these
                are the words the baked clip speaks, on screen before, during and
                after any audio — the words are the content, the voice is the
                enhancement. Never hide or swap this text while audio plays. */}
            <MessageBubble from="tutor">
              Hi {name}. I&apos;m Natalie, and I help you with schoolwork. Tell me what you&apos;re
              working on and we&apos;ll do one together right now.
            </MessageBubble>
            {/* The baked greeting (doc 36 §2 · doc 32 Path B): the same words,
                out loud, on tap. When the clip can't come back the button simply
                goes — the text is the guarantee, the audio is the warmth. */}
            {greeting.phase === 'ready' ? (
              <AudioPlayer uri={greeting.uri} label="Natalie says hi" className="w-full" />
            ) : greeting.phase === 'silent' ? null : (
              <Button
                size="lg"
                variant="outline"
                title={greeting.phase === 'loading' ? 'One sec…' : 'Hear Natalie say hi'}
                className="min-h-target-child w-full"
                onPress={() => void hearGreeting()}
                disabled={greeting.phase === 'loading'}
              />
            )}
            <Button
              size="lg"
              title="Hi Natalie"
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
                      // Button.tsx's own header: opacity alone was not enough —
                      // a 50%-opacity tile still reads as a tile, and it drops
                      // the label under 4.5:1 on the way (WCAG 1.4.3). The kit's
                      // treatment for unavailable is a muted FILL, full-contrast
                      // text, and the affordance removed.
                      full ? 'border-border bg-surface-sunken' : '',
                    ].join(' ')}
                  >
                    <TWText
                      className={[
                        'font-display text-body-lg font-bold',
                        full ? 'text-text-muted' : 'text-text',
                      ].join(' ')}
                    >
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

        {step === 'win' ? <Win onNext={() => forward && setStep(forward)} /> : null}

        {step === 'snap' ? (
          <Section className="items-center gap-group">
            <Avatar name="Natalie" size="xl" />
            {/* No sample worksheet: the asset doc 37 §2 imagined does not exist
                yet (open item, doc 37 §2 amendment), and a pretend worksheet
                would make the first Snap a rehearsal of nothing. Their own
                homework is the honest subject — it is also the doc's whole
                thesis (§1.2): teach the camera at the camera, on real work. */}
            <MessageBubble from="tutor">
              One more thing, {name} — this is how we work together. Point the camera at your own
              homework and I&apos;ll look at it with you. Want to try?
            </MessageBubble>
            <Button
              size="lg"
              title="Try it on your homework"
              className="min-h-target-child w-full"
              onPress={onTrySnap}
            />
            {/* The explicit skip doc 37 §2 requires: a full-size button, not a
                corner link a child cannot find — declining is a real choice. */}
            <Button
              size="lg"
              variant="outline"
              title="Maybe later"
              className="min-h-target-child w-full"
              onPress={onDone}
            />
          </Section>
        ) : null}
      </View>
    </Dial>
  );
}

/**
 * The tiny win. One question, drawn from the first subject they tapped, so the
 * first thing they get right is the thing they came for. A wrong tap answers
 * again — no lockout, no score, and the copy is "Not yet" (doc 04 §S10).
 */
function Win({ onNext }: { onNext: () => void }) {
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
        <Button size="lg" title="Let's go" className="min-h-target-child w-full" onPress={onNext} />
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
          {/* Announced (WCAG 4.1.3) and at full contrast (1.4.3): this is the
              one line telling a child what to do next, and muted grey is where
              feedback goes to be missed. Not redpen — doc 08 §4.8 keeps red for
              marking an answer, and this marks the next try. */}
          <Text role="alert" variant="body" className="text-text">
            {item.notYet}
          </Text>
        </FadeIn>
      ) : null}
    </Section>
  );
}
