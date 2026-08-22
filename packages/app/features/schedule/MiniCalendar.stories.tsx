// SOT-KEYWORDS: minicalendar calendar month grid stories schedule day picker
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Text, View } from '@acme/ui/tw';
import { MiniCalendar } from './MiniCalendar';

const meta = { title: 'Schedule/MiniCalendar' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

// Fixed dates — `today` is a prop precisely so renders stay deterministic,
// which is what makes this story diffable in a screenshot matrix.
const TODAY = new Date(2026, 5, 24);
const MONTH = new Date(2026, 5, 1);

export const Default: Story = {
  render: function Interactive() {
    // Story-local demo state; app state uses the schedule store.
    const [month, setMonth] = useState(MONTH);
    const [selected, setSelected] = useState(TODAY);
    return (
      <View className="gap-stack bg-surface p-inset" style={{ maxWidth: 340 }}>
        <MiniCalendar
          month={month}
          selected={selected}
          today={TODAY}
          onSelect={setSelected}
          onMonthChange={setMonth}
        />
        <Text className="font-mono text-caption text-text-muted">
          selected {selected.toDateString()}
        </Text>
      </View>
    );
  },
};

/** Selection away from today, so the two markers are distinguishable. */
export const SelectedIsNotToday: Story = {
  render: () => (
    <View className="bg-surface p-inset" style={{ maxWidth: 340 }}>
      <MiniCalendar
        month={MONTH}
        selected={new Date(2026, 5, 11)}
        today={TODAY}
        onSelect={() => {}}
        onMonthChange={() => {}}
      />
    </View>
  ),
};

/** A month the selection does not fall in — the grid still renders its own days. */
export const ViewingAnotherMonth: Story = {
  render: () => (
    <View className="bg-surface p-inset" style={{ maxWidth: 340 }}>
      <MiniCalendar
        month={new Date(2026, 8, 1)}
        selected={TODAY}
        today={TODAY}
        onSelect={() => {}}
        onMonthChange={() => {}}
      />
    </View>
  ),
};
