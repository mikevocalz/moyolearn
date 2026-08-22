// SOT-KEYWORDS: audio voice recorder stories microphone permission take
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useRef, useState } from 'react';
import { Text, View } from '../primitives';
import { AudioPlayer } from './AudioPlayer';
import type { VoiceRecording } from './VoiceRecorder.types';
import { VoiceRecorder } from './VoiceRecorder';

const meta = {
  title: 'Audio/VoiceRecorder',
  component: VoiceRecorder,
} satisfies Meta<typeof VoiceRecorder>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { onComplete: () => {}, onCancel: () => {} },
  render: () => (
    <View className="gap-stack bg-surface p-inset">
      <VoiceRecorder onComplete={() => {}} onCancel={() => {}} />
      <Text className="text-caption text-text-muted">
        The browser will ask for microphone access on first record.
      </Text>
    </View>
  ),
};

export const StopsAtMaxSeconds: Story = {
  args: { onComplete: () => {}, onCancel: () => {}, maxSeconds: 10 },
  render: () => (
    <View className="gap-stack bg-surface p-inset">
      <VoiceRecorder onComplete={() => {}} onCancel={() => {}} maxSeconds={10} />
      <Text className="text-caption text-text-muted">maxSeconds=10 — stops itself.</Text>
    </View>
  ),
};

/**
 * The real loop: record, then hand the take straight to the player. This is the
 * pair as a learner actually meets it, which a recorder-only story cannot show.
 */
export const RecordThenPlayBack: Story = {
  args: { onComplete: () => {}, onCancel: () => {} },
  render: function RecordThenPlay() {
    // Repo rule: no React useState for app state. This is throwaway story-local
    // state for one demo surface, which is what useState is legitimately for.
    const [take, setTake] = useState<VoiceRecording | null>(null);
    const nonce = useRef(0);
    return (
      <View className="gap-group bg-surface p-inset">
        <VoiceRecorder
          key={nonce.current}
          onComplete={(r) => setTake(r)}
          onCancel={() => setTake(null)}
          maxSeconds={30}
        />
        {take ? (
          <View className="gap-stack">
            <Text className="text-label text-text">Your take</Text>
            <AudioPlayer uri={take.uri} duration={take.duration} levels={take.levels} />
          </View>
        ) : (
          <Text className="text-caption text-text-muted">Record something to see it play back.</Text>
        )}
      </View>
    );
  },
};
