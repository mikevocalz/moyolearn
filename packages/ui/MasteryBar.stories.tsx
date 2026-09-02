import type { Meta, StoryObj } from '@storybook/react-vite';
import { Dial } from './Dial';
import { MasteryBar } from './MasteryBar';
import { Text, View } from './primitives';

const meta = { title: 'UI/MasteryBar', component: MasteryBar } satisfies Meta<typeof MasteryBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { value: 82, label: 'Fractions' } };

/**
 * The dignity rule made visible (doc 08 §4.8): a struggling child gets
 * HIGHLIGHTER, never redpen. Red pen means "marked wrong", and a child's
 * overall progress is never wrong.
 */
export const StatesSideBySide: Story = {
  args: { value: 41, label: 'Long division' },
  render: () => (
    <View className="gap-group bg-surface p-6">
      <MasteryBar value={82} label="Fractions" />
      <MasteryBar value={41} label="Long division" state="needs-attention" />
      <MasteryBar value={100} label="Place value" />
      <Text className="text-caption text-text-muted">
        needs-attention is highlighter, not redpen — redpen marks an answer, never the child.
      </Text>
    </View>
  ),
};

export const AtBothDials: Story = {
  args: { value: 67, label: 'Word problems' },
  render: () => (
    <View className="flex-row gap-group bg-surface p-6">
      <Dial temperature="cool">
        <View className="flex-1 gap-stack">
          <Text className="font-mono text-caption uppercase tracking-widest text-text-muted">cool</Text>
          <MasteryBar value={67} label="Word problems" />
        </View>
      </Dial>
      <Dial temperature="hot">
        <View className="flex-1 gap-stack">
          <Text className="font-mono text-caption uppercase tracking-widest text-text-muted">hot</Text>
          <MasteryBar value={67} label="Word problems" />
        </View>
      </Dial>
    </View>
  ),
};

/**
 * Band-aware sizing (doc 08 §2.4): the band comes from the signed-in learner's
 * profile. With `onPress` the whole bar is a practice shortcut, so the root
 * clears the band's target token — a K–2 shortcut clears 72px, not just a
 * thicker track. No band keeps today's md default.
 */
export const AtEveryBand: Story = {
  args: { value: 58, label: 'Skip counting' },
  render: () => (
    <View className="gap-group bg-surface p-6">
      <MasteryBar value={58} label="Skip counting" band="young" onPress={() => {}} />
      <MasteryBar value={64} label="Fractions" band="child" onPress={() => {}} />
      <MasteryBar value={71} label="Linear equations" band="teen" />
      <MasteryBar value={77} label="Course progress" band="adult" />
      <MasteryBar value={82} label="No band — md default" />
    </View>
  ),
};

/** Clamped: a projection that briefly exceeds its bounds is a bug, not a UI state. */
export const OutOfRangeIsClamped: Story = {
  args: { value: 140, label: 'Clamped to 100' },
  render: () => (
    <View className="gap-stack bg-surface p-6">
      <MasteryBar value={140} label="Reported 140" />
      <MasteryBar value={-20} label="Reported -20" />
    </View>
  ),
};
