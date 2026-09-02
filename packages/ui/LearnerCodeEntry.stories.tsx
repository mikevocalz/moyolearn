import type { Meta, StoryObj } from '@storybook/react-vite';
import { create } from 'zustand';
import { LearnerCodeEntry } from './LearnerCodeEntry';
import { Button } from './Button';
import { View } from './primitives';
import { Text } from './Text';
import { Heading } from './Heading';

// Story state — zustand always (repo rule).
const useCodeStory = create<{ code: string; setCode: (code: string) => void }>((set) => ({
  code: '',
  setCode: (code) => set({ code }),
}));

const meta = {
  title: 'UI/LearnerCodeEntry',
  component: LearnerCodeEntry,
  args: { value: '', onChange: () => undefined },
} satisfies Meta<typeof LearnerCodeEntry>;
export default meta;
type Story = StoryObj<typeof meta>;

// FD-08 in miniature: K–2 copy (≤ 6 words/line), giant cells on a 72dp
// young-band row, no auto-submit — the button is the commit — and the scan
// affordance in its slot. Learner surfaces are single-pane, max-w 560.
export const EnterYourCode: Story = {
  render: function Render() {
    const { code, setCode } = useCodeStory();
    return (
      <View className="max-w-xl items-stretch gap-group p-4">
        <View className="gap-1.5">
          <Heading size="display-sm">Type your code</Heading>
          <Text tone="muted">Ask your grown-up for it.</Text>
        </View>
        <LearnerCodeEntry
          value={code}
          onChange={setCode}
          scanSlot={<Button variant="outline" size="xl" title="Scan instead" onPress={() => undefined} />}
        />
        <Button size="xl" fullWidth title="Let's go" disabled={code.length < 6} onPress={() => undefined} />
      </View>
    );
  },
};

export const States: Story = {
  render: () => (
    <View className="max-w-xl gap-6 p-4">
      <LearnerCodeEntry value="" onChange={() => undefined} />
      <LearnerCodeEntry value="ABC23" onChange={() => undefined} />
      <LearnerCodeEntry
        value="ABC234"
        onChange={() => undefined}
        error="That code didn't work. Try again."
      />
      <LearnerCodeEntry value="AB" onChange={() => undefined} disabled />
    </View>
  ),
};
