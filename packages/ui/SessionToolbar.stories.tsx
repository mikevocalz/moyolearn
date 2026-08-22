import type { Meta, StoryObj } from '@storybook/react-vite';
import { SessionToolbar } from './SessionToolbar';

const meta = { title: 'UI/SessionToolbar' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <SessionToolbar title="Long division" />,
};

export const WithCaptions: Story = {
  render: () => <SessionToolbar title="Long division" captionsEnabled onToggleCaptions={() => {}} />,
};