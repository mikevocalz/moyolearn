'use client';
// TutorStage — the S9 tutor session surface (doc 23 §3).
// Renders one state of the discriminated union; no `error` or `paywall` state exists.
// SOT: docs/pack/23-tutorstage-handoff.md §3 · §5
// SOT-KEYWORDS: tutorstage s9 tutor session state union hot dial learner

import { useCallback, useState } from 'react';
import { Dial } from './Dial';
import { View, Text } from './primitives';
import { MessageBubble } from './MessageBubble';
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

/** The nine-state contract. Kinds are drawn only when the canvas has signed off. */
export type TutorStageState =
  | { kind: 'presence' }                        // §3.1 first paint, 2D mark
  | { kind: 'speaking'; utterance: Utterance }  // §3.2 her turn, captioned
  | { kind: 'thinking' }                        // §3.3 streaming first token
  | { kind: 'hint'; step: HintStep }            // §3.4 hint ladder
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
  onBack?: () => void;
  onToggleCaptions?: () => void;
  onSend?: (message: string) => void;
  onTryIt?: () => void;
  onNextHint?: () => void;
  onPracticeOnOwn?: () => void;
  onBackToPlan?: () => void;
  className?: string;
}

function statusFor(state: TutorStageState): string {
  switch (state.kind) {
    case 'presence': return 'Here';
    case 'speaking': return 'Speaking';
    case 'thinking': return 'Thinking';
    case 'hint': return 'Waiting for you';
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
  onTryIt?: () => void;
  onNextHint?: () => void;
  onPracticeOnOwn?: () => void;
  onBackToPlan?: () => void;
}

function StateBody({
  state,
  childName,
  questionNumber,
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
      return <MessageBubble from="tutor">{state.utterance.text}</MessageBubble>;
    case 'thinking':
      return <Text className="font-sans text-body text-text-muted">Natalie is thinking</Text>;
    case 'hint':
      return (
        <View className="w-full gap-stack">
          <MessageBubble from="tutor">{state.step.message}</MessageBubble>
          <Text className="font-mono text-data text-text-muted">
            Hint {state.step.index} of {state.step.total}
          </Text>
          <View className="flex-row flex-wrap gap-3">
            <Button
              title="I'll try it"
              variant="highlighter"
              size="md"
              onPress={onTryIt}
              aria-label="Try it myself"
            />
            <Button
              title="Show me the next hint"
              variant="outline"
              size="md"
              onPress={onNextHint}
              aria-label="Show next hint"
            />
          </View>
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
            size="md"
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
            size="md"
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
  onBack,
  onToggleCaptions,
  onSend,
  onTryIt,
  onNextHint,
  onPracticeOnOwn,
  onBackToPlan,
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

  const inputDisabled = state.kind === 'ended' || state.kind === 'crisis' || state.kind === 'paused';

  const stageBody = (
    <View className="w-full gap-stack p-inset">
      <Badge label={statusFor(state)} tone={statusTone(state)} />
      <View className="flex-1 justify-center">
        <StateBody
          state={state}
          childName={childName}
          questionNumber={questionNumber}
          onTryIt={onTryIt}
          onNextHint={onNextHint}
          onPracticeOnOwn={onPracticeOnOwn}
          onBackToPlan={onBackToPlan}
        />
      </View>
      <Composer value={draft} onChangeText={setDraft} onSend={handleSend} disabled={inputDisabled} />
    </View>
  );

  return (
    <Dial temperature="hot">
      <View className={`flex-1 bg-surface gap-stack ${className ?? ''}`}>
        <SessionToolbar
          title={title}
          captionsEnabled={captionsEnabled}
          onBack={onBack}
          onToggleCaptions={onToggleCaptions}
        />
        {sizeClass === 'regular' ? (
          <View className="flex-1 flex-row gap-group p-inset">
            <View className="w-pane-tutor">{stageBody}</View>
            <LearningCanvas className="flex-1" />
          </View>
        ) : (
          <View className="flex-1">{stageBody}</View>
        )}
      </View>
    </Dial>
  );
}
