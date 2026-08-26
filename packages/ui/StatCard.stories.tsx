import type { Meta, StoryObj } from '@storybook/react-vite';
import { Dial } from './Dial';
import { StatCard } from './StatCard';
import { View } from './primitives';

const meta = { title: 'UI/StatCard', component: StatCard } satisfies Meta<typeof StatCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { value: '128', label: 'Sessions this month' } };

/** Trend is text as well as colour — direction is never colour-only (WCAG 1.4.1). */
export const WithTrend: Story = {
  args: { value: '128', label: 'Sessions this month' },
  render: () => (
    <View className="flex-row flex-wrap gap-stack bg-surface p-6">
      <StatCard value="128" label="Sessions this month" trend="+12 vs May" trendDirection="up" />
      <StatCard value="$4,210" label="Invoiced" trend="−$340 vs May" trendDirection="down" />
      <StatCard value="94%" label="Attendance" trend="flat" />
    </View>
  ),
};

export const AtBothDials: Story = {
  args: { value: '41%', label: 'Mastery' },
  render: () => (
    <View className="flex-row gap-group bg-surface p-6">
      <Dial temperature="cool">
        <StatCard value="128" label="Sessions this month" />
      </Dial>
      <Dial temperature="hot">
        <StatCard value="128" label="Sessions this month" />
      </Dial>
    </View>
  ),
};
