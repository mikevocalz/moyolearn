import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TutorStage } from './TutorStage';
import { Avatar } from './Avatar';
import { View, Text } from './primitives';
import type { TutorPresencePreference } from './tutor-view';

const meta = { title: 'UI/TutorStage' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/*
  Every story passes an `avatar`. She used to be drawn in one branch of the
  state switch, so the stories that mattered — speaking, thinking, hint — all
  showed a tutor surface with no tutor on it and nobody noticed for months.
  Passing her everywhere is what makes that regression visible here first.
*/
const base = {
  title: 'Long division',
  tutorName: 'Natalie',
  childName: 'Maya',
  questionNumber: 4,
  avatar: <Avatar name="Natalie" size="xl" />,
  onSend: () => {},
  onTryIt: () => {},
  onNextHint: () => {},
  onPracticeOnOwn: () => {},
  onBackToPlan: () => {},
} as const;

export const Presence: Story = {
  render: () => <TutorStage {...base} state={{ kind: 'presence' }} />,
};

export const Speaking: Story = {
  render: () => (
    <TutorStage
      {...base}
      state={{
        kind: 'speaking',
        utterance: { text: 'Not yet — look at the 7 on the left side. What undoes adding 7?' },
      }}
    />
  ),
};

export const Thinking: Story = {
  render: () => <TutorStage {...base} state={{ kind: 'thinking' }} />,
};

export const Hint: Story = {
  render: () => (
    <TutorStage
      {...base}
      state={{
        kind: 'hint',
        step: { index: 1, total: 3, message: 'What operation is the opposite of addition?' },
      }}
    />
  ),
};

export const Listening: Story = {
  render: () => <TutorStage {...base} state={{ kind: 'listening' }} />,
};

export const Paused: Story = {
  render: () => <TutorStage {...base} state={{ kind: 'paused', since: Date.now() }} />,
};

export const Ended: Story = {
  render: () => (
    <TutorStage
      {...base}
      state={{ kind: 'ended', summary: { title: 'Great work today', masteryDelta: 12 } }}
    />
  ),
};

export const Retry: Story = {
  render: () => <TutorStage {...base} state={{ kind: 'retry' }} />,
};

export const Crisis: Story = {
  render: () => <TutorStage {...base} state={{ kind: 'crisis' }} />,
};

/** Collapsed: the rail carries her mark, her name and what she is doing. */
export const NatalieHidden: Story = {
  render: () => (
    <TutorStage
      {...base}
      tutorPresence="compact"
      onTutorPresenceChange={() => {}}
      presenceAssurance="She can still hear you and you can still hear her."
      state={{
        kind: 'speaking',
        utterance: { text: 'Not yet — look at the 7 on the left side. What undoes adding 7?' },
      }}
    />
  ),
};

/** Voice only: no mark at all, and the status is the whole interface. */
export const VoiceOnly: Story = {
  render: () => (
    <TutorStage
      {...base}
      tutorPresence="audio-only"
      collapsedPresence="audio-only"
      onTutorPresenceChange={() => {}}
      state={{ kind: 'speaking', utterance: { text: 'Try the left side first.' } }}
    />
  ),
};

/** The reveal itself — press the rail and watch her arrive. */
export const Reveal: Story = {
  render: function RevealStory() {
    const [presence, setPresence] = useState<TutorPresencePreference>('compact');
    return (
      <TutorStage
        {...base}
        tutorPresence={presence}
        onTutorPresenceChange={setPresence}
        presenceAssurance="She can still hear you and you can still hear her."
        state={{ kind: 'listening' }}
      />
    );
  },
};

/** Two-pane: the conversation beside the learner's own work (doc 23 §5). */
export const WithWorkCanvas: Story = {
  render: () => (
    <TutorStage
      {...base}
      tutorPresence="visible"
      onTutorPresenceChange={() => {}}
      state={{ kind: 'thinking' }}
      canvas={
        <View className="flex-1 gap-group">
          <Text className="font-mono text-display-md text-text">3x + 7 = 22</Text>
        </View>
      }
    />
  ),
};
