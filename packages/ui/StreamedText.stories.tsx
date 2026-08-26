import type { Meta, StoryObj } from '@storybook/react-vite';
import { StreamedText } from './StreamedText';

const meta = {
  title: 'UI/StreamedText',
  component: StreamedText,
} satisfies Meta<typeof StreamedText>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: 'Show me how you started.' },
};
