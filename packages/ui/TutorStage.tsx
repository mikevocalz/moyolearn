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
import { AdaptivePanes } from './adaptive-panes';
import { isCollapsed } from './adaptive-panes/constants';
import { PaneToggle } from './adaptive-panes/PaneToggle';
import { TRANSITIONS } from './adaptive-panes/transitions.ts';
import { useWindowSizeClass } from './adaptive-panes/use-window-size-class';
import { Dial } from './Dial';
import { MotionView } from './motion';
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

/**
 * Width of the conversation pane, in dp.
 *
 * Not the `w-pane-primary` token (280) and not the `expanded` rail step (224):
 * both are list widths. This is the narrowest width at which the three things
 * the leading pane has to hold — her status rail as ONE row, a message bubble
 * with a readable measure, and the composer's single-row footer — all still
 * work, measured on the Duo's unfolded 1080dp window. It is a default: the
 * pane divider resizes it within `PRIMARY_WIDTH_MIN`/`MAX` (200-420).
 */
const CONVERSATION_PANE_DP = 380;

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
    THE PANE WIDTH CLASS, and it is the four-band one on purpose.

    `useSizeClass()`'s binary 768 line answers "one column or two" for content.
    This answers "may panes tile", which is `AdaptivePanes`' own question, and
    600dp (`medium`) is where its policy says the first one can. The two systems
    are documented as deliberately separate in `adaptive-panes/constants.ts`;
    this screen is simply the first that asks both.
  */
  const windowClass = useWindowSizeClass();

  /*
    `auto` is a request, not a presentation. It is normally answered at the
    screen (grade band → size class → reduced motion), but the prop's type still
    admits it and the default is a literal, so it is answered here too rather
    than leaving three branches below that cannot be drawn.
  */
  const presence: ResolvedTutorPresence = tutorPresence === 'auto' ? 'compact' : tutorPresence;

  /*
    PANES ON THE TUTOR SESSION — a signed exception, not a drift.

    Doc 37 §3.3 and ADR-107 ban split compositions on learner surfaces. Mike
    amended ADR-107 twice on 2026-09-03: first to exempt THIS screen and only
    this screen, then to widen the exempted composition from two panes to
    three — conversation, work, Natalie — after seeing the two-pane form. Both
    amendments name him, the date, and the conditions they carry, and the first
    condition is the one this code has to honour: nothing is reachable in a pane
    that is not reachable without it, which is why this is not the attention
    arbitrage the ban exists to prevent.

    Gated at `medium` (600dp) — `AdaptivePanes`' own first pane-capable class —
    so a phone keeps the single spine it has always had. Condition 3.
  */
  const panes = !isCollapsed(windowClass);

  /*
    THE WORK IS WIDTH-DEPENDENT, and deliberately so. Do not "fix" either half
    of this back to match the other.

    · ON A PHONE (and at `medium`, where a third column has nowhere to go) the
      work rides INSIDE the turn that raised it — `MessageBubble`'s `media`
      slot. That is `docs/design/tutor-session-thread-first.md`, it is the right
      answer at 540dp, and it is verified on the Duo's single screen.
    · AT THREE-COLUMN WIDTH the work takes the middle pane again, which is what
      doc 23 §5 always specified and what an unfolded 1080dp window has the room
      for. A homework photo and a line of arithmetic inside a 380dp message
      bubble is not the same artefact as the same photo across 300dp of pane.

    And it still only earns the pane when there IS work: `canvas` is undefined
    until the learner has a problem or a photo, and an empty middle column is
    the empty-box problem doc 23 §5 already ruled on.
  */
  const workPane = panes && windowClass !== 'medium' && canvas !== undefined;

  /*
    HER PANE *IS* THE REVEAL — so it starts CLOSED, and the control opens it.

    This used to force `compact` up to `visible` the moment the window was wide
    enough, on the reasoning that a column of her own answers "keep the face
    small because the window is". That reasoning was about SIZE and the mistake
    was about CONSENT: it meant a learner who had put her away got her back,
    full height, by unfolding the device — and the header control then read
    "hide" for a pane they never asked to open.

    Her presence is now the pane's visibility, in both directions and at every
    width. `compact` (the default, and what the store seeds) draws the rail in
    the conversation and NO pane; `visible` opens the pane and animates her in.
    One fact, one control, one persisted answer per learner — instead of a
    layout preference in `pane-overrides` that would fork from her presence the
    first time a learner unfolded the device. See `AdaptivePanes`' `detailOpen`.

    `audio-only` is untouched on purpose. Reduce Motion resolves to it (spec §1
    rule 2) and that band never gets `visible`, by width or by anything else.
  */
  const panePresence: ResolvedTutorPresence = presence;
  const detailOpen = presence === 'visible';

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

  /*
    AT WIDTH THE RAIL STOPS BEING A CONTROL, and that is the fix for having two
    of them rather than a second control for the same job.

    In the spine the rail is the one way to hide her. In the pane composition
    the HEADER's "Natalie" toggle hides her pane, which is the same intent
    expressed on the thing it acts on — so the rail keeps her name and her live
    status and drops its press target. `TutorPresence` already draws exactly
    that when `onToggleReveal` is omitted; nothing new is written here.
  */
  const railToggle = panes ? undefined : handleToggleReveal;

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

  /*
    NATALIE, IN EVERY STATE, AND ONLY ONCE ON SCREEN.

    Status belongs to the person whose status it is: one element carries her
    mark, her name and what she is doing, so a child who has collapsed her still
    has a visible owner for the voice they can hear. In the single spine that is
    one card. In the pane composition the two halves split by PLACEMENT — her
    body takes the pane, her rail keeps the conversation's full measure — because
    a 280dp pane breaks the rail into two-character fragments. Never both, never
    twice.
  */
  const presenceProps = {
    name: tutorName,
    status: statusFor(state),
    tone: statusTone(state),
    tutorPresence: panePresence,
    onToggleReveal: railToggle,
    assurance: presenceAssurance,
    size: buttonSize,
  } as const;

  const presenceBlock = panes ? (
    <TutorPresence {...presenceProps} render="rail" />
  ) : (
    <TutorPresence {...presenceProps} avatar={avatar} />
  );

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
      {/* Her rail in the pane composition, her whole card in the spine. */}
      {presenceBlock}
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
            /* Only when the work has no pane of its own — never in both places
               at once, which would put the same photo on screen twice. */
            work={workPane ? undefined : canvas}
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

  /*
    THE TWO CONTROLS, IN THE HEADER, ONE PER TOGGLABLE PANE.

    They are `PaneToggle` reading `pane-overrides` — the same component and the
    same precedence policy every adult pane surface uses, mounted somewhere
    else. `AdaptivePanes` is told `paneControls={false}` so there is exactly one
    row of them on screen, not two.

    Each renders itself away in any size class that cannot show its pane, so at
    `medium` this is the Natalie control alone (no third column fits, so no work
    pane exists to toggle) and at `compact` the header is not given them at all.

    NO CONTROL FOR THE CONVERSATION. It is the session; a screen whose only
    remaining pane could be dismissed is a screen a child can empty by accident.
    `resolvePaneVisibility` would refuse the last one anyway, and a control that
    cannot act is worse than no control.
  */
  const paneControls = panes ? (
    <>
      {workPane ? <PaneToggle pane="supplementary" columnCount={2} label="Homework" /> : null}
      {/*
        HERS IS CONTROLLED. The Homework toggle beside it is a layout
        preference and belongs in `pane-overrides`; this one reports her
        presence and asks the screen to change it, so the header, the rail in
        the conversation and the pane itself are three views of one state
        rather than three states. Same component, same chrome, same label.
      */}
      {handleToggleReveal ? (
        <PaneToggle
          pane="detail"
          columnCount={workPane ? 2 : 1}
          label={tutorName}
          visible={detailOpen}
          onToggle={handleToggleReveal}
        />
      ) : null}
    </>
  ) : undefined;

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
          paneControls={paneControls}
        />
        {panes ? (
          /*
            THE HOST, LEFT TO RIGHT: conversation · work · Natalie.

            The same `AdaptivePanes` every adult pane surface uses, so a
            learner's split view is not a second implementation of one.
            `topColumnForCollapsing` is deliberately absent: this host never
            collapses, because `panes` is false below the class where it would.

            `primaryWidthDp` because the leading pane holds a CONVERSATION. The
            automatic policy steps the primary pane down to a 224dp rail at
            `expanded` before dropping it, which is right for a list of icons
            and wrong for a thread with a composer in it — 380dp is the width at
            which her status rail still reads as one row (measured: at 280dp
            "Speaking" broke across three lines, which is what the first
            amendment's §render split was working around). The divider still
            resizes it.

            SHE IS THE DETAIL PANE, and that is what answers "make sure her view
            has high z-index" — structurally rather than with a number. The
            detail pane is the LAST child of the row, so on Android it paints
            after both panes before it, and both of those are inside
            `CollapsiblePane`, which clips. Nothing can paint over her without
            first overflowing a clip, and if something ever does, the clip on
            the offender is the fix. A z-index would only have hidden it.

            Her pane is also the only one here that never animates its width,
            which is what the 3D upgrade needs: a canvas that is resized every
            frame of a collapse would rebuild its swapchain on each one.
          */
          <AdaptivePanes
            paneControls={false}
            detailOpen={detailOpen}
            primaryWidthDp={CONVERSATION_PANE_DP}
            detail={
              /*
                SHE IS THE WHOLE PANE, centred in it. A figure hugging the
                ceiling of a tall column reads as a leftover element rather than
                a placed one, and doc 23 §3.1's rule holds: the mark carries the
                ink border and no slab shadow, because border + shadow + yellow
                is the primary-button treatment and the one thing here that is
                not a control must not wear it.
              */
              /*
                THIS IS THE VIEW THAT ANIMATES HER IN — the parent of the
                presence, not the presence itself.

                `TutorPresence`'s own `MotionView` fades the AVATAR inside a
                pane that is already there. That is the right animation in the
                spine, where the pane never moves; here it left the column
                arriving as an instant empty rectangle with a face catching up
                inside it. One movement, on the container, so the pane and its
                occupant arrive together.

                ANIMATED, NOT REMOUNTED. Keying this on the open state replayed
                `initial` on every toggle, which also tore down and rebuilt the
                presence subtree underneath — a remount in the middle of the
                pane's own open/close, which is what cost that transition its
                smoothness. Driving `animate` from the same flag keeps the
                subtree mounted (and frozen while shut), and it animates both
                ways instead of only in.
              */
              <MotionView
                className="flex-1 items-center justify-center gap-stack bg-surface-sunken p-inset"
                initial={{ opacity: 0, scale: 0.94, y: 12 }}
                animate={{
                  opacity: detailOpen ? 1 : 0,
                  scale: detailOpen ? 1 : 0.94,
                  y: detailOpen ? 0 : 12,
                }}
                transition={TRANSITIONS.disclosure}>
                <TutorPresence {...presenceProps} avatar={avatar} />
              </MotionView>
            }>
            <AdaptivePanes.Column>
              {/*
                THREE PANES, THREE GROUNDS, ALL OF THEM THE DARK ONE.

                Untinted, the columns were one field of `bg-surface` with two
                hairlines drawn on it, so the composition read as a screen with
                lines rather than as panes. The stories this host was promoted
                from have always shaded them (AdaptivePanes.stories.tsx): the
                reading surface keeps `surface`, the ones flanking it step off
                it.

                The CONVERSATION keeps `bg-surface` — plain, the same ground
                every other screen in the app has, because it is the page here
                and its shade is not a decision this screen gets to make. The
                work bench is `surface-raised` (one step up: ink 800 in the
                dark, white by day — a sheet laid on the page), and Natalie's
                pane is `surface-sunken` (one step down: ink 950 — an alcove she
                stands in, and the darkest of the three so her mark carries).
                Same ramp in both schemes; nothing here is a hex.
              */}
              <View className="flex-1 bg-surface">
                <View className="mx-auto w-full max-w-content-prose flex-1">{stageBody}</View>
              </View>
            </AdaptivePanes.Column>
            {workPane ? (
              <AdaptivePanes.Column>
                {/*
                  Top-aligned, not `flex-1`-stretched. `TutorWorkCanvas` sizes
                  to its content (`w-full`) since it was inlined into a turn,
                  and that is still the honest measurement here: a one-line
                  problem stretched to the height of the column is a lavender
                  field with an equation floating in it, which is the exact
                  defect that change fixed. The PANE is full height; the work
                  sits at the top of it.
                */}
                <View className="flex-1 gap-stack bg-surface-raised p-inset">{canvas}</View>
              </AdaptivePanes.Column>
            ) : null}
          </AdaptivePanes>
        ) : (
          <View className="mx-auto w-full max-w-content-prose flex-1">{stageBody}</View>
        )}
      </View>
    </Dial>
  );
}
