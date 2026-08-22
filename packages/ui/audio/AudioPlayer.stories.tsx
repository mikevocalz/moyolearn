// SOT-KEYWORDS: audio player stories playback waveform levels
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Text, View } from '../primitives';
import { AudioPlayer } from './AudioPlayer';

const meta = { title: 'Audio/AudioPlayer', component: AudioPlayer } satisfies Meta<typeof AudioPlayer>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A plausible envelope: quiet start, a loud middle, trailing off. */
const LEVELS = Array.from({ length: 48 }, (_, i) => {
  const t = i / 47;
  return Math.max(0.06, Math.sin(t * Math.PI) * (0.55 + 0.35 * Math.sin(i * 1.7)));
});

/**
 * `uri` is a real remote sample so the control is genuinely operable here —
 * a player story with a dead source only proves the component mounts.
 */
const SAMPLE = 'https://upload.wikimedia.org/wikipedia/commons/c/c8/Example.ogg';

export const WithKnownLevels: Story = {
  args: {
    uri: SAMPLE,
    duration: 6,
    levels: LEVELS,
    label: "Amina's answer · fractions",
  },
  render: (args) => (
    <View className="gap-stack bg-surface p-inset">
      <AudioPlayer {...args} />
      <Text className="text-caption text-text-muted">
        Levels supplied by the caller — captured at record time, so nothing is decoded to draw.
      </Text>
    </View>
  ),
};

/** No levels: the player decodes the file itself. */
export const DecodesWhenLevelsOmitted: Story = {
  args: { uri: SAMPLE, label: 'Decoded from the file' },
  render: (args) => (
    <View className="bg-surface p-inset">
      <AudioPlayer {...args} />
    </View>
  ),
};
