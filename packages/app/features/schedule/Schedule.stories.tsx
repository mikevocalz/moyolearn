// The day/week schedule with pressable events.
// SOT-KEYWORDS: schedule calendar day week grid events pressable booking stories S1
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Text, View } from '@acme/ui/tw';
import { DEMO_DAY, DEMO_NOW } from './fixtures';
import { Schedule } from './Schedule';
import { ScheduleGrid } from './ScheduleGrid';
import { useScheduleStore } from './store';

const meta = { title: 'Schedule/Schedule' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * S1, the first fully-realised screen (doc 09): resource columns, a live time
 * rule, and events you can press. The Day/Week toggle lives in the component's
 * own header and drives the schedule store, so switching views here exercises
 * the real code path rather than a story-local flag.
 */
export const DayAndWeek: Story = {
  render: () => (
    <View className="h-[560px] bg-surface">
      <Schedule
        fill
        day={DEMO_DAY}
        now={DEMO_NOW}
        onBook={() => {}}
        onNewBooking={() => {}}
      />
    </View>
  ),
};

export const Loading: Story = {
  render: () => (
    <View className="h-[560px] bg-surface">
      <Schedule fill loading day={DEMO_DAY} now={DEMO_NOW} onBook={() => {}} onNewBooking={() => {}} />
    </View>
  ),
};

/**
 * The grid on its own — columns are resources, the date is fixed. Pressing an
 * event selects it in the schedule store; the selection is what an inspector
 * pane would read.
 */
export const GridOnly: Story = {
  render: function Grid() {
    const selected = useScheduleStore((s) => s.selectedEventId);
    return (
      <View className="gap-stack bg-surface p-inset">
        <Text className="font-mono text-caption text-text-muted">
          selectedEventId: {selected ?? '(none)'} — press an event to change it
        </Text>
        <View className="h-[460px] overflow-hidden border-2 border-border">
          <ScheduleGrid day={DEMO_DAY} now={DEMO_NOW} />
        </View>
      </View>
    );
  },
};
