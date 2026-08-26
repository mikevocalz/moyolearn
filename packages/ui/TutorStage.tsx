'use client';
// TutorStage — the S9 tutor session surface (doc 23 §3).
// Renders one state of the discriminated union; no `error` or `paywall` state exists.
// Mobbin: https://mobbin.com/screens/84573c60-48ee-428c-9cf7-c0ad14ddf7f2 (Speak — tutor turn owns the
// full column, composer pinned full-width beneath it) · https://mobbin.com/screens/5def00a9-6228-4ccc-81a3-25cdb2fe20bd
// (Pi — secondary affordances are small icon rows under the message, never a filled button beside the
// composer) · https://mobbin.com/screens/9c13ada9-0c95-45c8-9932-d20010b96e14 (ChatGPT — one minimal
// header, actions as icons). Structure only: the reading measure, the composer position, and the rule
// that nothing sits beside the conversation unless it has content.
// SOT: docs/pack/23-tutorstage-handoff.md §3 · §5
// SOT-KEYWORDS: tutorstage s9 tutor session state union hot dial learner

import { useCallback, useState } from 'react';
import { Dial } from './Dial';
import { View, Text } from './primitives';
import { MessageBubble } from './MessageBubble';
import { StreamedText } from './StreamedText';
import { Composer } from './Composer';
import { SessionToolbar } from './SessionToolbar';
import { Badge } from './Badge';
import { Button } from './Button';
import { Avatar } from './Avatar';
import { LearningCanvas } from './LearningCanvas';
import { useSizeClass } from './use-size-class';

/** A spoken or written turn from the tutor. */
export interface Utterance {
  text: string;
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
  title: string;
  childName?: string;
  questionNumber?: number;
  captionsEnabled?: boolean;
  buttonSize?: 'sm' | 'md' | 'lg' | 'xl';
  onBack?: () => void;
  onToggleCaptions?: () => void;
  onSend?: (message: string) => void;
  onTryIt?: () => void;
  onNextHint?: () => void;
  onPracticeOnOwn?: () => void;
  onBackToPlan?: () => void;
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
}: StateBodyProps) {
  switch (state.kind) {
    case 'presence':
      return (
        <View className="w-full items-center gap-stack">
          <Avatar name="Natalie" size="xl" />
          <Text className="max-w-content-prose text-center font-sans text-body text-text">
            Hi {childName ?? 'there'}. We were on question {questionNumber ?? '...'} — want to pick up there?
          </Text>
        </View>
      );
    case 'speaking':
      return (
        <MessageBubble from="tutor">
          <StreamedText>{state.utterance.text}</StreamedText>
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
          <View className="flex-row flex-wrap gap-3">
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
        <View className="flex-row items-center gap-2">
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
      return <Text className="font-sans text-body text-text-muted">Hmm, that didn&apos;t stick — try again</Text>;
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
  childName,
  questionNumber,
  captionsEnabled,
  buttonSize,
  onBack,
  onToggleCaptions,
  onSend,
  onTryIt,
  onNextHint,
  onPracticeOnOwn,
  onBackToPlan,
  canvas,
  className,
}: TutorStageProps) {
  const [draft, setDraft] = useState('');
  const sizeClass = useSizeClass();

  const handleSend = useCallback(() => {
    const message = draft.trim();
    if (!message) return;
    onSend?.(message);
    setDraft('');
  }, [draft, onSend]);

  const inputDisabled =
    state.kind === 'ended' ||
    state.kind === 'crisis' ||
    state.kind === 'paused' ||
    state.kind === 'hint' ||
    state.kind === 'thinking';

  const stageBody = (
    <View className="w-full flex-1 gap-stack p-inset">
      <Badge label={statusFor(state)} tone={statusTone(state)} />
      {/* Top-aligned, not centred. A turn grows downward as it streams, and a
          vertically centred block re-centres on every arriving sentence — the
          text slides under the reader while they are reading it. */}
      <View className="flex-1">
        <StateBody
          state={state}
          childName={childName}
          questionNumber={questionNumber}
          buttonSize={buttonSize}
          onTryIt={onTryIt}
          onNextHint={onNextHint}
          onPracticeOnOwn={onPracticeOnOwn}
          onBackToPlan={onBackToPlan}
        />
      </View>
      <Composer
        value={draft}
        onChangeText={setDraft}
        onSend={handleSend}
        disabled={inputDisabled}
        size={buttonSize}
      />
    </View>
  );

  // Doc 23 §5 sizes the tutor pane at 380px for the case it describes: a
  // conversation running BESIDE a worked canvas. With no canvas that split put a
  // 380px column of content next to a ~1000px empty bordered box, which read as
  // the empty box being the subject of the screen. So the canvas is opt-in, and
  // without one the conversation gets the screen and a readable measure cap.
  const twoPane = sizeClass === 'regular' && canvas !== undefined;

  return (
    <Dial temperature="hot">
      <View className={`flex-1 bg-surface gap-stack ${className ?? ''}`}>
        <SessionToolbar
          title={title}
          captionsEnabled={captionsEnabled}
          onBack={onBack}
          onToggleCaptions={onToggleCaptions}
        />
        {twoPane ? (
          <View className="flex-1 flex-row gap-group p-inset">
            <View className="w-pane-tutor">{stageBody}</View>
            <LearningCanvas className="flex-1">{canvas}</LearningCanvas>
          </View>
        ) : (
          <View className="mx-auto w-full max-w-content-prose flex-1">{stageBody}</View>
        )}
      </View>
    </Dial>
  );
}
