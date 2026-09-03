'use client';
// TutorStage — the S9 tutor session surface (doc 23 §3).
// Renders one state of the discriminated union; no `error` or `paywall` state exists.
// Mobbin: https://mobbin.com/screens/84573c60-48ee-428c-9cf7-c0ad14ddf7f2 (Speak — tutor turn owns the
// full column, composer pinned full-width beneath it) · https://mobbin.com/screens/5def00a9-6228-4ccc-81a3-25cdb2fe20bd
// (Pi — secondary affordances are small icon rows under the message, never a filled button beside the
// composer) · https://mobbin.com/screens/9c13ada9-0c95-45c8-9932-d20010b96e14 (ChatGPT — one minimal
// header, actions as icons) · https://mobbin.com/screens/76e16697-0e20-4bfc-8162-e93d6f1fc8ff
// (Mistral Le Chat — the material under discussion rides INSIDE the turn that raised it, in the
// thread, not on a board beside it) · https://mobbin.com/screens/6a3715d2-6cda-4f77-ad80-99787a5fde37
// (WhatsApp web — attachments are messages; the bar carries who you are talking to and their live
// status). Structure only: the reading measure, the composer position, and the rule that nothing
// sits beside the conversation unless it has content.
//
// THREAD-FIRST (2026-09-03). Two things moved into the conversation and the second pane went away.
//   · The work — the problem, the photo — was a second pane. It is now content of a TURN
//     (`MessageBubble`'s `media` slot), so the session reads as one conversation instead of a
//     conversation plus a board. Doc 23 §5's second column existed to hold the work; with the work
//     in the thread it has nothing to hold, so it is gone rather than left standing empty.
//   · The LIVE turn was a fixed band between the thread and the composer — permanent height, and the
//     newest words on screen were the one thing a child could not scroll to. It is now the last row
//     of the same list (`TutorThread`'s `live` footer), scroll indicator off, list pinned to the end.
//   · Natalie stays exactly where she was, at the head of the spine, drawn by `TutorPresence`.
//   Width therefore buys ONE thing: a centred, measure-capped conversation. There is no second
//   column and no third, because there is no longer a second thing to put in one.
//   See docs/design/tutor-session-thread-first.md.
// SOT: docs/pack/23-tutorstage-handoff.md §3 · §5 · docs/design/tutor-session-thread-first.md
// SOT-KEYWORDS: tutorstage s9 tutor session state union hot dial learner thread first live turn work in turn

import { useCallback, useState } from 'react';
import { Dial } from './Dial';
import { View, Text } from './primitives';
import { MessageBubble } from './MessageBubble';
import { StreamedText } from './StreamedText';
import { Composer } from './Composer';
import type { TutorAttachment } from './tutor-attachment.ts';
import type { TutorMessage } from './tutor-message.ts';
import { TutorThread } from './TutorThread';
import { SessionToolbar } from './SessionToolbar';
import { Badge } from './Badge';
import { Button } from './Button';
import { TutorPresence } from './TutorPresence';
import type { ResolvedTutorPresence, TutorPresencePreference } from './tutor-view';

/** A spoken or written turn from the tutor. */
export interface Utterance {
  text: string;
  /**
   * True when this turn is being RESTORED rather than spoken.
   *
   * A resumed session puts Natalie's last turn back as the live turn, so the
   * child lands on the question they were mid-answer on. Without this flag the
   * reveal animation replays it character by character — retyping, slowly, a
   * reply they already read and closed the laptop on. The animation belongs to
   * text arriving, not to text remembered.
   */
  restored?: boolean;
}

/** One rung on the productive-struggle hint ladder. */
export interface HintStep {
  index: number;
  total: number;
  message: string;
}

/** End-of-session summary: effort and transfer, not streaks. */
export interface SessionSummary {
  title: string;
  masteryDelta: number;
}

/** The ten-state contract. Kinds are drawn only when the canvas has signed off. */
export type TutorStageState =
  | { kind: 'presence' }                        // §3.1 first paint, 2D mark
  | { kind: 'speaking'; utterance: Utterance }  // §3.2 her turn, captioned
  | { kind: 'thinking' }                        // §3.3 streaming first token
  | { kind: 'hint'; step: HintStep }            // §3.4 hint ladder
  | { kind: 'diagnosis'; name: string; message: string } // §3.4a named misconception
  | { kind: 'listening' }                       // §3.5 mic open
  | { kind: 'paused'; since: number }           // §3.6 fail-closed, safe
  | { kind: 'ended'; summary: SessionSummary }  // §3.7 session end
  | { kind: 'retry' }                           // §3.8 inline retry, not drawn
  | { kind: 'crisis' };                         // §3.9 terminal, not drawn

export interface TutorStageProps {
  state: TutorStageState;
  /**
   * What this session is — "Long division", not "Natalie".
   *
   * Doc 23 §2: the header answers "what is this screen" precisely BECAUSE the
   * avatar already answers "who am I talking to". While the avatar was missing
   * the header had been carrying her name instead, which left the session
   * itself unnamed on every screen.
   */
  title: string;
  /** Who the learner is talking to. Drawn by `TutorPresence`, not by the header. */
  tutorName?: string;
  childName?: string;
  questionNumber?: number;
  tutorPresence?: TutorPresencePreference;
  onTutorPresenceChange?: (presence: TutorPresencePreference) => void;
  /**
   * Where "hide Natalie" puts her.
   *
   * A prop rather than a remembered previous value: the screen is the only
   * place that knows whether this learner's collapsed register is a small face
   * or her voice alone (Reduce Motion resolves to `audio-only`, spec §1 rule 2),
   * and a stage that guessed would hand a vestibular-sensitive learner an
   * avatar it had just been told not to draw.
   */
  collapsedPresence?: Exclude<ResolvedTutorPresence, 'visible'>;
  /**
   * The younger bands' reassurance line under her status — "She can still hear
   * you." Supplied by the screen, which knows the grade band; K–2 needs telling
   * that a hidden tutor is still listening, and 9–12 does not.
   */
  presenceAssurance?: string;
  /** Optional embodied presence. When absent the stage draws its own 2D mark. */
  avatar?: React.ReactNode;
  captionsEnabled?: boolean;
  buttonSize?: 'sm' | 'md' | 'lg' | 'xl';
  onBack?: () => void;
  onToggleCaptions?: () => void;
  onSend?: (message: string) => void;
  /** The conversation so far. Empty on a fresh session. */
  messages?: readonly TutorMessage[];
  /*
    Composer pass-throughs. The stage deliberately holds none of this state:
    what a learner has attached belongs to the session, not to the layout that
    happens to be drawing the input this frame.
  */
  attachments?: readonly TutorAttachment[];
  onRemoveAttachment?: (id: string) => void;
  onPickCamera?: () => void;
  onPickImage?: () => void;
  onPickDocument?: () => void;
  onStartRecording?: () => void;
  recording?: { elapsedSec: number; levels: readonly number[] };
  onCancelRecording?: () => void;
  onStopRecording?: () => void;
  onSendRecording?: () => void;
  onTryIt?: () => void;
  onNextHint?: () => void;
  onPracticeOnOwn?: () => void;
  onBackToPlan?: () => void;
  /** Re-attempt a turn that never reached the tutor. */
  onRetry?: () => void;
  /**
   * The work this session is about — the problem, and the photo the learner
   * took of it. It renders INSIDE the conversation, as the most recent thing
   * put on the table, rather than on a board beside it.
   *
   * The prop keeps its name because the screen already passes it and the
   * content is unchanged (`TutorWorkCanvas`); what changed is where the stage
   * puts it. Omit it and nothing is drawn — an absent problem is not an empty
   * card, it is simply a turn that has no work attached yet.
   */
  canvas?: React.ReactNode;
  className?: string;
}

function statusFor(state: TutorStageState): string {
  switch (state.kind) {
    case 'presence': return 'Here';
    case 'speaking': return 'Speaking';
    case 'thinking': return 'Thinking';
    case 'hint': return 'Waiting for you';
    case 'diagnosis': return 'Diagnosis';
    case 'listening': return 'Listening';
    case 'paused': return 'Taking a break';
    case 'ended': return 'Session done';
    case 'retry': return 'Retry';
    case 'crisis': return 'Crisis';
  }
}

function statusTone(state: TutorStageState): React.ComponentProps<typeof Badge>['tone'] {
  switch (state.kind) {
    case 'presence':
    case 'speaking':
    case 'listening':
    case 'ended':
      return 'success';
    case 'thinking':
      return 'primary';
    case 'diagnosis':
      return 'accent';
    case 'hint':
    case 'paused':
    default:
      return 'neutral';
  }
}

interface StateBodyProps {
  state: TutorStageState;
  /**
   * The work, riding inside the live turn.
   *
   * Every state that speaks carries it in its own bubble, so the problem sits
   * with the sentence about the problem. States that do not speak — the
   * greeting, the break, the ending — get it as a turn of its own directly
   * above, because the work is still what the session is about even when
   * nobody is mid-sentence, and a child scrolling back must find it in the
   * thread rather than in a place the thread does not go.
   */
  work?: React.ReactNode;
  childName?: string;
  questionNumber?: number;
  buttonSize?: 'sm' | 'md' | 'lg' | 'xl';
  onTryIt?: () => void;
  onNextHint?: () => void;
  onPracticeOnOwn?: () => void;
  onBackToPlan?: () => void;
  onRetry?: () => void;
}

function StateBody({
  state,
  work,
  childName,
  questionNumber,
  buttonSize = 'md',
  onTryIt,
  onNextHint,
  onPracticeOnOwn,
  onBackToPlan,
  onRetry,
}: StateBodyProps) {
  /*
    The work as a turn of its own, for the states with no bubble to ride in.
    A media-only `MessageBubble` — Natalie's surface, her side of the thread,
    no words — which is exactly what "here is what we're working on" is when
    nobody is speaking.
  */
  const workTurn = work === undefined ? null : <MessageBubble from="tutor" media={work} />;

  switch (state.kind) {
    case 'presence':
      return (
        <View className="w-full items-center gap-stack">
          {workTurn}
          {/*
              NO AVATAR HERE ANY MORE. She used to be drawn in this branch and
              only this branch, so the opening turn — which fires on arrival —
              took her off the screen for the rest of the session. Presence is
              not one state of the conversation; `TutorPresence` draws her in
              every state, including this one, at the head of the spine.
          */}
          <Text className="max-w-content-prose text-center font-sans text-body text-text">
            {/*
                NO PLACEHOLDER. This read "We were on question ..." — literally
                three dots — because nothing has ever passed `questionNumber`. A
                greeting that names the question when it knows it and greets
                plainly when it does not is honest; one that shows an ellipsis
                where the question goes tells a child their place was lost.

                A resumed session no longer lands here at all: the last tutor
                turn is restored as the live turn, so the child sees the actual
                question. This is the FIRST-paint state now, which is what §3.1
                always meant.
            */}
            {questionNumber !== undefined
              ? `Hi ${childName ?? 'there'}. We were on question ${questionNumber} — want to pick up there?`
              : `Hi ${childName ?? 'there'}. Ready when you are.`}
          </Text>
        </View>
      );
    case 'speaking':
      return (
        /* The work rides INSIDE her turn: she is talking about this problem,
           so it is in the bubble with the sentence rather than beside it. */
        <MessageBubble from="tutor" media={work}>
          <StreamedText instant={state.utterance.restored}>{state.utterance.text}</StreamedText>
        </MessageBubble>
      );
    case 'thinking':
      return (
        <View className="w-full gap-stack">
          {workTurn}
          <Text className="font-sans text-body text-text-muted">Natalie is thinking</Text>
        </View>
      );
    case 'hint':
      return (
        <View className="w-full gap-stack">
          <MessageBubble from="tutor" media={work}>
            <StreamedText>{state.step.message}</StreamedText>
          </MessageBubble>
          <Text className="font-mono text-data text-text-muted">
            Hint {state.step.index} of {state.step.total}
          </Text>
          <View className="flex-row flex-wrap gap-stack">
            <Button
              title="I'll try it"
              variant="highlighter"
              size={buttonSize}
              onPress={onTryIt}
              aria-label="Try it myself"
            />
            <Button
              title="Show me the next hint"
              variant="outline"
              size={buttonSize}
              onPress={onNextHint}
              aria-label="Show next hint"
            />
          </View>
        </View>
      );
    case 'diagnosis':
      return (
        <View className="w-full gap-stack">
          <MessageBubble from="tutor" media={work}>
            <StreamedText>{state.message}</StreamedText>
          </MessageBubble>
          <Badge label={state.name} tone="accent" />
          <Button
            title="Try again"
            variant="highlighter"
            size={buttonSize}
            fullWidth
            onPress={onTryIt}
            aria-label="Try the problem again"
          />
        </View>
      );
    case 'listening':
      return (
        <View className="w-full gap-stack">
          {workTurn}
          <View className="flex-row items-center gap-element">
            <View className="h-3 w-3 rounded-full bg-danger" />
            <Text className="font-sans text-body text-text-muted">Listening</Text>
          </View>
        </View>
      );
    case 'paused':
      return (
        <View className="w-full gap-stack">
          {workTurn}
          <Text className="font-sans text-body text-text">
            Natalie is taking a break. Nothing you did — she&apos;ll be back in a moment.
          </Text>
          {questionNumber !== undefined ? (
            <Text className="font-sans text-caption text-text-muted">
              Your work on question {questionNumber} is saved.
            </Text>
          ) : null}
          <Button
            title="Practice on my own"
            variant="highlighter"
            size={buttonSize}
            fullWidth
            onPress={onPracticeOnOwn}
            aria-label="Practice on my own"
          />
        </View>
      );
    case 'ended':
      return (
        <View className="w-full gap-stack">
          <Text className="font-display text-display-sm font-bold text-text">
            {state.summary.title}
          </Text>
          <Text className="font-mono text-data-lg text-grade">+{state.summary.masteryDelta}%</Text>
          <Button
            title="Back to my plan"
            variant="highlighter"
            size={buttonSize}
            fullWidth
            onPress={onBackToPlan}
            aria-label="Back to my plan"
          />
        </View>
      );
    case 'retry':
      return (
        <View className="w-full gap-stack">
          <Text className="font-sans text-body text-text">
            I couldn&apos;t reach Natalie just then. Your work is saved.
          </Text>
          <Button
            title="Try again"
            variant="highlighter"
            size={buttonSize}
            onPress={onRetry}
            aria-label="Try reaching Natalie again"
          />
        </View>
      );
    case 'crisis':
      return <Text className="font-sans text-body text-text">Please tell a trusted adult.</Text>;
  }
}

/**
 * The one-screen container. Each branch in §3 gets its own file as it is filled in;
 * this component owns the dispatch, the accessibility announcements, and the
 * compact/regular layout split.
 */
export function TutorStage({
  state,
  title,
  tutorName = 'Natalie',
  childName,
  questionNumber,
  tutorPresence = 'compact',
  onTutorPresenceChange,
  collapsedPresence = 'compact',
  presenceAssurance,
  avatar,
  captionsEnabled,
  buttonSize,
  onBack,
  onToggleCaptions,
  onSend,
  messages,
  attachments,
  onRemoveAttachment,
  onPickCamera,
  onPickImage,
  onPickDocument,
  onStartRecording,
  recording,
  onCancelRecording,
  onStopRecording,
  onSendRecording,
  onTryIt,
  onNextHint,
  onPracticeOnOwn,
  onBackToPlan,
  onRetry,
  canvas,
  className,
}: TutorStageProps) {
  const [draft, setDraft] = useState('');

  /*
    `auto` is a request, not a presentation. It is normally answered at the
    screen (grade band → size class → reduced motion), but the prop's type still
    admits it and the default is a literal, so it is answered here too rather
    than leaving three branches below that cannot be drawn.
  */
  const presence: ResolvedTutorPresence = tutorPresence === 'auto' ? 'compact' : tutorPresence;

  /*
    ONE control for Natalie's presence, and it lives with her.

    The toolbar used to carry a text button that cycled
    visible → compact → audio-only, so "bring her back" was two presses from
    voice-only and every label named a transition instead of a state. The rail
    under her says what she is doing and toggles her in one press, both ways.
  */
  const handleToggleReveal = onTutorPresenceChange
    ? () => onTutorPresenceChange(presence === 'visible' ? collapsedPresence : 'visible')
    : undefined;

  const handleSend = useCallback(() => {
    const message = draft.trim();
    /*
      An attachment is a message. Gating on text alone meant a photo of a
      problem with no caption hit an enabled Send button that did nothing — the
      composer said the turn was sendable and this threw it away. A child
      photographing homework usually has nothing to add in words; that IS the
      question.
    */
    if (!message && (attachments?.length ?? 0) === 0) return;
    onSend?.(message);
    setDraft('');
  }, [draft, onSend, attachments]);

  // Only states where the session is genuinely over lock the composer.
  // `hint` and `thinking` locked out a child who was mid-answer, and `paused`
  // made an unreachable tutor look like an app that had stopped accepting
  // input at all. A learner can always write; whether it sends is a separate
  // question, and `canSend` already answers it.
  const inputDisabled = state.kind === 'ended' || state.kind === 'crisis';

  const stageBody = (
    /*
      Extra room BELOW the composer, not just the container's inset.

      The row sat flush against the bottom edge — on a phone that is where the
      home indicator lives, and on any device it reads as the input having been
      cut off rather than placed. A composer needs the same air beneath it that
      the thread has above it, or the screen looks like it continues past the
      fold.
    */
    <View
      /*
        4pt top and bottom, not the page inset. The thread is a FOOTER LIST:
        the composer sits against the bottom edge and Natalie's status against
        the header, so the generous page padding that suits a document left a
        visible band of nothing at both ends of a conversation. The horizontal
        inset stays — that is the reading measure — but vertically the list runs
        to its edges and lets the chrome above and below define the boundary.
      */
      className="w-full flex-1 gap-stack px-inset py-1"
    >
      {/*
        NATALIE, IN EVERY STATE, AT THE TOP OF THE SPINE.

        The status chip used to float here on its own while she was drawn — or
        not drawn — somewhere below by one branch of the state switch. Status
        belongs to the person whose status it is: one element carries her mark,
        her name and what she is doing, so a child who has collapsed her still
        has a visible owner for the voice they can hear.
      */}
      <TutorPresence
        name={tutorName}
        status={statusFor(state)}
        tone={statusTone(state)}
        tutorPresence={presence}
        avatar={avatar}
        onToggleReveal={handleToggleReveal}
        assurance={presenceAssurance}
        size={buttonSize}
      />
      {/*
        ONE LIST. History and the live turn used to be two siblings — a
        virtualised thread, then a fixed band holding whatever Natalie was
        saying this second. That band cost the conversation a permanent strip of
        height and, worse, put the newest words on screen outside the scroll, so
        a child could scroll every sentence except the one they were reading.

        The live turn is now the list's last row: a message that happens to be
        animating. The thread renders even with no history behind it, because a
        session that has only just opened still has a turn to show and it
        belongs in the same place every later turn will appear.
      */}
      <TutorThread
        messages={messages ?? []}
        live={
          <StateBody
            work={canvas}
            state={state}
            childName={childName}
            questionNumber={questionNumber}
            buttonSize={buttonSize}
            onTryIt={onTryIt}
            onNextHint={onNextHint}
            onPracticeOnOwn={onPracticeOnOwn}
            onBackToPlan={onBackToPlan}
            onRetry={onRetry}
          />
        }
      />
      <Composer
        value={draft}
        onChangeText={setDraft}
        onSend={handleSend}
        disabled={inputDisabled}
        size={buttonSize}
        attachments={attachments}
        onRemoveAttachment={onRemoveAttachment}
        onPickCamera={onPickCamera}
        onPickImage={onPickImage}
        onPickDocument={onPickDocument}
        onStartRecording={onStartRecording}
        recording={recording}
        onCancelRecording={onCancelRecording}
        onStopRecording={onStopRecording}
        onSendRecording={onSendRecording}
      />
    </View>
  );

  // Doc 23 §5's second column held the worked canvas. The work is a turn now,
  // so that column has nothing to hold and is gone rather than left standing
  // empty — the same reasoning that kept it opt-in before (an empty bordered
  // box beside a 380pt thread reads as the box being the subject of the screen)
  // applied once the box had no contents at all. Width therefore buys the
  // conversation a centred, measure-capped column and nothing else; see
  // docs/design/tutor-session-thread-first.md for why there is no second pane
  // and no third.

  return (
    /*
      `flex-1` on the Dial, not just inside it. Dial renders a plain View, so it
      is a link in the flex chain like any other — without it the chain broke
      here and every `flex-1` below collapsed to content height. On web that
      showed as a tutor screen ending halfway down with the footer pulled up
      under it; the conversation is the whole screen and should own it.
    */
    <Dial temperature="hot" className="flex-1">
      <View className={`flex-1 bg-surface gap-stack ${className ?? ''}`}>
        <SessionToolbar
          title={title}
          captionsEnabled={captionsEnabled}
          onBack={onBack}
          onToggleCaptions={onToggleCaptions}
        />
        <View className="mx-auto w-full max-w-content-prose flex-1">{stageBody}</View>
      </View>
    </Dial>
  );
}
