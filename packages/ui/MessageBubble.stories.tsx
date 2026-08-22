import type { Meta, StoryObj } from '@storybook/react-vite';
import { MessageBubble } from './MessageBubble';

const meta = { title: 'UI/MessageBubble' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Tutor: Story = {
  render: () => (
    <MessageBubble from="tutor">Hello! Let&apos;s work through this together.</MessageBubble>
  ),
};

export const Child: Story = {
  render: () => (
    <MessageBubble from="child">I think I add 7?</MessageBubble>
  ),
};