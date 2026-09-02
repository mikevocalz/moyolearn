// SOT-KEYWORDS: toast card stories status variants action dismiss
import type { Meta, StoryObj } from '@storybook/react-vite';
import { View } from './primitives';
import { ToastCard } from './ToastCard';

const meta = {
  title: 'UI/ToastCard',
  component: ToastCard,
  args: { title: 'Saved', description: 'Session notes are backed up.' },
} satisfies Meta<typeof ToastCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Info: Story = {
  render: (args) => (
    <View className="w-96 bg-surface p-inset">
      <ToastCard {...args} />
    </View>
  ),
};

/** Colour lives on the tile, never the card — the status is loud, not the words. */
export const AllVariants: Story = {
  render: () => (
    <View className="w-96 gap-stack bg-surface p-inset">
      <ToastCard variant="info" title="Heads up" description="Tomorrow's session moved to 10:00." />
      <ToastCard variant="success" title="Uploaded" description="worksheet.pdf is in this session." />
      <ToastCard variant="warning" title="Almost out of space" description="Two uploads left this week." />
      <ToastCard variant="error" title="Upload failed" description="worksheet.pdf did not go through." />
      <ToastCard variant="loading" title="Uploading" description="worksheet.pdf · 42%" />
    </View>
  ),
};

/** One action, right-aligned — more than one belongs in a dialog, not a toast. */
export const WithActionAndDismiss: Story = {
  render: () => (
    <View className="w-96 bg-surface p-inset">
      <ToastCard
        variant="error"
        title="Upload failed"
        description="worksheet.pdf did not go through."
        action={{ label: 'Retry', onPress: () => {} }}
        onDismiss={() => {}}
      />
    </View>
  ),
};
