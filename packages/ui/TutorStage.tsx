'use client';
// TutorStage — the S9 tutor session surface (doc 23 §3).
// Renders one state of the discriminated union; no `error` or `paywall` state exists.
// Mobbin: https://mobbin.com/screens/84573c60-48ee-428c-9cf7-c0ad14ddf7f2 (Speak — tutor turn owns the
// full column, composer pinned full-width beneath it) · https://mobbin.com/screens/5def00a9-6228-4ccc-81a3-25cdb2fe20bd
// (Pi — secondary affordances are small icon rows under the message, never a filled button beside the
// composer) · https://mobbin.com/screens/9c13ada9-0c95-45c8-9932-d20010b96e14 (ChatGPT — one minimal
// header, actions as icons) · https://mobbin.com/screens/76e16697-0e20-4bfc-8162-e93d6f1fc8ff
// (Mistral Le Chat — conversation column, work canvas beside it, trailing panel dismissible from its
// own chrome) · https://mobbin.com/screens/e1f475cd-9340-4b6d-98c3-9ad852993175 (Fibery — the third
// column is the assistant and it closes from a control in the bar). Structure only: the reading
// measure, the composer position, and the rule that nothing sits beside the conversation unless it
// has content.
// SOT: docs/pack/23-tutorstage-handoff.md §3 · §5 · docs/design/tutor-stage-third-column.md
// SOT-KEYWORDS: tutorstage s9 tutor session state union hot dial learner three column stage pane

import { useCallback, useState } from 'react';
import { useWindowSizeClass } from './adaptive-panes/use-window-size-class';
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
import { LearningCanvas } from './LearningCanvas';
import { useSizeClass } from './use-size-class';
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
   * Worked-out content for the side canvas (doc 23 §5). Omit it and the
   * conversation takes the whole screen — an empty workspace is not a
   * workspace, it is a large empty box competing with the thing that matters.
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
  childName,
  questionNumber,
  buttonSize = 'md',
  onTryIt,
  onNextHint,
  onPracticeOnOwn,
  onBackToPlan,
  onRetry,
}: StateBodyProps) {
  switch (state.kind) {
    case 'presence':
      return (
        <View className="w-full items-center gap-stack">
          {/*
              NO AVATAR HERE ANY MORE. She used to be drawn in this branch and
              only this branch, so the opening turn — which fires on arrival —
              took her off the screen for the rest of the session. Presence is
              not one state of the conversation; `TutorPresence` above the
              thread draws her in every state, including this one.
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
        <MessageBubble from="tutor">
          <StreamedText instant={state.utterance.restored}>{state.utterance.text}</StreamedText>
        </MessageBubble>
      );
    case 'thinking':
      return <Text className="font-sans text-body text-text-muted">Natalie is thinking</Text>;
    case 'hint':
      return (
        <View className="w-full gap-stack">
          <MessageBubble from="tutor">
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
          <MessageBubble from="tutor">
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
        <View className="flex-row items-center gap-element">
          <View className="h-3 w-3 rounded-full bg-danger" />
          <Text className="font-sans text-body text-text-muted">Listening</Text>
        </View>
      );
    case 'paused':
      return (
        <View className="w-full gap-stack">
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
  const sizeClass = useSizeClass();
  /*
    THE SECOND WIDTH SYSTEM, read here on purpose.

    `useSizeClass()` is the binary 768 line this screen has always held: one
    column or two. The four M3 bands (`packages/ui/adaptive-panes/constants.ts`)
    answer a different question — how many panes TILE — and the third column
    below is a tiling decision, so it takes the band. The two are documented as
    deliberately separate in that file and are not merged here; this screen just
    happens to be the first that needs both answers.
  */
  const windowClass = useWindowSizeClass();
  /*
    The workspace is COLLAPSIBLE, and its control is in the header (see
    `SessionToolbar`). Local state rather than a store: which panes a learner
    has open right now is layout, not session data — nothing about it should
    survive a session or reach the tutor. It resets with the screen, which is
    the correct lifetime for "I pushed the work aside for a second".
  */
  const [workspaceHidden, setWorkspaceHidden] = useState(false);
  const toggleWorkspace = useCallback(() => {
    setWorkspaceHidden((hidden) => !hidden);
  }, []);

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

  // Doc 23 §5's two-pane rule, with the header's collapse control folded in:
  // the split needs a regular-width window AND real work to put in the second
  // pane AND the learner not having pushed that pane away.
  const workspacePane = sizeClass === 'regular' && canvas !== undefined && !workspaceHidden;

  /*
    THE THIRD COLUMN — Natalie's own pane, and the narrowest gate in this file.

    It requires ALL of: the `large` band (≥1200dp — doc 02 §2.1's own 3-pane
    class), a workspace already earning the second pane, and the learner
    actually having her revealed. Anything less and she stays where she has
    always been: the top of the conversation spine.

    Why so narrow, in one line: doc 37 §3.3 and ADR-107 ban split compositions
    on learner surfaces, and doc 23 §5 specifies two columns for this screen.
    A third column is a SPEC DELTA, filed in
    `docs/design/tutor-stage-third-column.md`, and it is gated at a width no
    phone and no foldable in the current device matrix reports — an unfolded
    Surface Duo measures ~1080dp, which is `expanded`, so the demo device runs
    exactly the two-pane layout it ran before this existed.

    Known constraint, written down rather than discovered later: moving her
    between the spine and this column is a REMOUNT, because it is a different
    branch of the tree. That costs nothing today (`TutorAvatar` renders a static
    mark), but a live 3D renderer must not be remounted mid-session — see
    `audit/realtime/ADR-avatar-identity.md`, which makes a single mount site a
    precondition of the 3D swap rather than a later clean-up.
  */
  const stagePane = workspacePane && windowClass === 'large' && presence === 'visible';

  const presenceBlock = (
    /*
      NATALIE, IN EVERY STATE, AND ONLY EVER IN ONE PLACE ON SCREEN.

      The status chip used to float in the spine on its own while she was drawn
      — or not drawn — somewhere below by one branch of the state switch. Status
      belongs to the person whose status it is: one element carries her mark,
      her name and what she is doing, so a child who has collapsed her still has
      a visible owner for the voice they can hear. That element is rendered once
      and placed either at the head of the spine or in the stage column, never
      both.
    */
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
      {/* Her place in the spine — unless the stage column has taken her. */}
      {stagePane ? null : presenceBlock}
      {/* Top-aligned, not centred. A turn grows downward as it streams, and a
          vertically centred block re-centres on every arriving sentence — the
          text slides under the reader while they are reading it. */}
      {/* History above, live turn below. A sent photo stays where the child
          put it instead of vanishing when Natalie replies. */}
      {messages && messages.length > 0 ? <TutorThread messages={messages} /> : null}

      <View className={messages && messages.length > 0 ? undefined : 'flex-1'}>
        <StateBody
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
      </View>
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

  // Doc 23 §5 sizes the tutor pane at 380px for the case it describes: a
  // conversation running BESIDE a worked canvas. With no canvas that split put a
  // 380px column of content next to a ~1000px empty bordered box, which read as
  // the empty box being the subject of the screen. So the canvas is opt-in, and
  // without one the conversation gets the screen and a readable measure cap.
  //
  // For a long time NOTHING passed `canvas`, so this was permanently false and
  // the split view doc 23 §5 specifies never rendered — a tablet or an unfolded
  // foldable ran the session as one narrow column with the rest of the window
  // empty. The condition was right; the second pane had no content. It has one
  // now: `TutorWorkCanvas` puts the learner's OWN problem and the photo they
  // snapped in the right-hand pane, which is what §5 means by "equation /
  // whiteboard" and the only thing that earns the width on a child's surface.
  // (`workspacePane` and `stagePane` above are the resolved answers.)

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
        {/* No presence control here any more — it moved onto the rail under
            Natalie, where the thing it controls actually is. */}
        <SessionToolbar
          title={title}
          captionsEnabled={captionsEnabled}
          onBack={onBack}
          onToggleCaptions={onToggleCaptions}
          workspaceVisible={workspacePane}
          /* The control exists only where a pane exists to collapse: regular
             width with real work in it. At phone width there is no second pane,
             so there is nothing for the button to mean. */
          onToggleWorkspace={
            sizeClass === 'regular' && canvas !== undefined ? toggleWorkspace : undefined
          }
        />
        {workspacePane ? (
          <View className="flex-1 flex-row gap-group p-inset">
            <View className="w-pane-tutor">{stageBody}</View>
            <LearningCanvas className="flex-1">{canvas}</LearningCanvas>
            {stagePane ? (
              /*
                THE STAGE COLUMN. She is centred in it rather than pinned to the
                top: this pane holds one person and her status, and a figure
                hugging the ceiling of a 900px column reads as a leftover
                element rather than a placed one. `justify-center` is the whole
                treatment — no border, no card. Doc 23 §3.1: the mark carries
                the ink border and no slab shadow, because border + shadow +
                yellow is the primary-button treatment and the one thing here
                that is not a control must not wear it.
              */
              <View className="w-pane-tutor-stage justify-center">{presenceBlock}</View>
            ) : null}
          </View>
        ) : (
          <View className="mx-auto w-full max-w-content-prose flex-1">{stageBody}</View>
        )}
      </View>
    </Dial>
  );
}
