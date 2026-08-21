// SOT-KEYWORDS: waveform stories levels bars progress audio
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Text, View } from '../tw';
// Extension required: `Waveform.tsx` (component) and `waveform.ts` (level maths)
// differ only in case, so an extensionless specifier resolves to the wrong one
// on a case-insensitive filesystem. packages/ui/audio/index.ts does the same.
import { Waveform } from './Waveform.tsx';

const meta = { title: 'Audio/Waveform', component: Waveform } satisfies Meta<typeof Waveform>;
export default meta;
type Story = StoryObj<typeof meta>;

const LEVELS = Array.from({ length: 48 }, (_, i) =>
  Math.max(0.06, Math.sin((i / 47) * Math.PI) * (0.55 + 0.35 * Math.sin(i * 1.7))),
);

export const Playback: Story = {
  args: { levels: LEVELS, progress: 0.45 },
  render: () => (
    <View className="gap-group bg-surface p-inset">
      {[0, 0.25, 0.6, 1].map((p) => (
        <View key={p} className="gap-element">
          <Text className="font-mono text-caption text-text-muted">progress {p}</Text>
          <Waveform levels={LEVELS} progress={p} />
        </View>
      ))}
    </View>
  ),
};

/** No progress = recording: every bar is "live" rather than played/unplayed. */
export const RecordingHasNoProgress: Story = {
  args: { levels: LEVELS.slice(0, 20) },
  render: () => (
    <View className="gap-stack bg-surface p-inset">
      <Waveform levels={LEVELS.slice(0, 20)} />
      <Text className="text-caption text-text-muted">
        Short arrays pad from the left, so a take grows rightwards as it records.
      </Text>
    </View>
  ),
};

export const Heights: Story = {
  args: { levels: LEVELS },
  render: () => (
    <View className="gap-group bg-surface p-inset">
      {[24, 40, 64].map((h) => (
        <View key={h} className="gap-element">
          <Text className="font-mono text-caption text-text-muted">height {h}</Text>
          <Waveform levels={LEVELS} progress={0.5} height={h} />
        </View>
      ))}
    </View>
  ),
};
