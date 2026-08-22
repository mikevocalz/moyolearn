import type { Meta, StoryObj } from '@storybook/react-vite';
import { Composer } from './Composer';

const meta = { title: 'UI/Composer' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Composer
      value="I think I add 7"
      onChangeText={() => {}}
      onSend={() => {}}
      placeholder="Type your answer"
    />
  ),
};