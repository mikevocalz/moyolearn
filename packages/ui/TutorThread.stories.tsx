// SOT-KEYWORDS: tutor thread stories conversation bubbles attachments transcript pagination
import type { Meta, StoryObj } from '@storybook/react-vite';
import { View } from './primitives';
import { TutorThread } from './TutorThread';
import type { TutorMessage } from './tutor-message';

const CONVERSATION: TutorMessage[] = [
  { id: '1', role: 'tutor', text: "Let's look at problem 4. What does the 7 do on the left side?" },
  { id: '2', role: 'learner', text: 'It gets added to x?' },
  { id: '3', role: 'tutor', text: 'Right. So what operation undoes adding 7?' },
  { id: '4', role: 'learner', text: 'Subtracting 7 from both sides!' },
  { id: '5', role: 'tutor', text: 'Exactly. Try it and tell me what x equals.' },
];

const meta = {
  title: 'UI/TutorThread',
  component: TutorThread,
  args: { messages: CONVERSATION },
} satisfies Meta<typeof TutorThread>;
export default meta;
type Story = StoryObj<typeof meta>;

/* The thread virtualises, so every story gives it a bounded height to scroll in. */
export const Conversation: Story = {
  render: (args) => (
    <View className="h-96 w-96 bg-surface p-inset">
      <TutorThread {...args} />
    </View>
  ),
};

/**
 * Attachments live INSIDE the bubble that carried them: image above its
 * caption, a voice note as one row with its transcript underneath, and an
 * expired photo stated rather than broken (doc 07 §4's retention promise).
 */
export const WithAttachments: Story = {
  render: () => (
    <View className="h-96 w-96 bg-surface p-inset">
      <TutorThread
        messages={[
          {
            id: '1',
            role: 'learner',
            text: 'Which step do I do first here?',
            attachments: [
              {
                id: 'img-1',
                kind: 'image',
                uri: 'https://picsum.photos/seed/homework/1200/800',
                name: 'homework.jpg',
                mimeType: 'image/jpeg',
              },
            ],
          },
          {
            id: '2',
            role: 'learner',
            text: '',
            attachments: [
              {
                id: 'audio-1',
                kind: 'audio',
                uri: 'https://upload.wikimedia.org/wikipedia/commons/c/c8/Example.ogg',
                name: 'voice-note.ogg',
                mimeType: 'audio/ogg',
                durationSec: 6,
                transcript: 'I tried dividing first but the numbers got weird.',
              },
            ],
          },
          {
            id: '3',
            role: 'learner',
            text: 'And this one from last week?',
            attachments: [
              {
                id: 'img-2',
                kind: 'image',
                uri: 'https://picsum.photos/seed/lastweek/1200/800',
                name: 'old-homework.jpg',
                mimeType: 'image/jpeg',
                expiresAt: '2020-01-01T00:00:00.000Z',
              },
            ],
          },
          { id: '4', role: 'tutor', text: 'Good instinct to try something! Look at the 7 first.' },
        ]}
      />
    </View>
  ),
};

/** Older turns load from an explicit labelled row at the top, never a silent scroll trigger. */
export const OlderMessagesAvailable: Story = {
  render: () => (
    <View className="h-96 w-96 bg-surface p-inset">
      <TutorThread messages={CONVERSATION} hasOlder onLoadOlder={() => {}} />
    </View>
  ),
};

export const LoadingOlder: Story = {
  render: () => (
    <View className="h-96 w-96 bg-surface p-inset">
      <TutorThread messages={CONVERSATION} hasOlder loadingOlder onLoadOlder={() => {}} />
    </View>
  ),
};
