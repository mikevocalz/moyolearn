import type { Meta, StoryObj } from '@storybook/react-vite';
import { TutorStage } from './TutorStage';

const meta = { title: 'UI/TutorStage' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const base = {
  title: 'Long division',
  childName: 'Maya',
  questionNumber: 4,
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
