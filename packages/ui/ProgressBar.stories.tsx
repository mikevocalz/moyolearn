// SOT-KEYWORDS: progress bar stories upload transfer determinate indeterminate failed
import type { Meta, StoryObj } from '@storybook/react-vite';
import { View } from '@acme/ui/tw';
import { ProgressBar } from './ProgressBar';

const meta = { title: 'Feedback/ProgressBar', component: ProgressBar } satisfies Meta<
  typeof ProgressBar
>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Uploading: Story = {
  args: { ratio: 0.42, label: 'Uploading worksheet.pdf', valueText: '42%' },
  render: (args) => (
    <View className="w-96 bg-surface p-inset">
      <ProgressBar {...args} />
    </View>
  ),
};

/**
 * Phase 2 of doc 29 §4: bytes have landed, Bunny is transcoding, and there is
 * no honest percentage — so the bar says "moving, amount unknown" instead of
 * sitting at a 100% that looks stuck.
 */
export const ProcessingIndeterminate: Story = {
  args: { ratio: null, label: 'Processing lesson-clip.mp4', valueText: 'Processing' },
  render: (args) => (
    <View className="w-96 bg-surface p-inset">
      <ProgressBar {...args} />
    </View>
  ),
};

export const Failed: Story = {
  args: { ratio: 0.6, label: 'Upload failed', valueText: '60%', tone: 'failed' },
  render: (args) => (
    <View className="w-96 bg-surface p-inset">
      <ProgressBar {...args} />
    </View>
  ),
};

/**
 * Band-aware sizing (doc 08 §2.4): the band comes from the signed-in learner,
 * so a K–2 upload row sits at the 72px target with a track thick enough to
 * read, while a call site with no band keeps today's compact default.
 */
export const AtEveryBand: Story = {
  args: { ratio: 0.42, label: 'Uploading homework photo', valueText: '42%' },
  render: () => (
    <View className="w-96 gap-group bg-surface p-inset">
      <ProgressBar ratio={0.42} label="Uploading homework photo" valueText="42%" band="young" />
      <ProgressBar ratio={0.42} label="Uploading homework photo" valueText="42%" band="child" />
      <ProgressBar ratio={0.42} label="Uploading homework photo" valueText="42%" band="teen" />
      <ProgressBar ratio={0.42} label="Uploading homework photo" valueText="42%" band="adult" />
      <ProgressBar ratio={0.42} label="No band — compact default" valueText="42%" />
    </View>
  ),
};
