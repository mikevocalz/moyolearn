import type { Meta, StoryObj } from '@storybook/react-vite';
import { LearningCanvas } from './LearningCanvas';

const meta = {
  title: 'UI/LearningCanvas',
  component: LearningCanvas,
} satisfies Meta<typeof LearningCanvas>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
