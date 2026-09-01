import type { Meta, StoryObj } from '@storybook/react-vite';
import { TenantScope } from './TenantScope';

const meta = {
  title: 'UI/TenantScope',
  component: TenantScope,
} satisfies Meta<typeof TenantScope>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: null },
};
