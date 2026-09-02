// SOT-KEYWORDS: trendline stories chart line sparkline suppression series
import type { Meta, StoryObj } from '@storybook/react-vite';
import { View } from './primitives';
import { TrendLine } from './TrendLine';
import type { TrendPoint } from './TrendLine.types';

const MONTHS: TrendPoint[] = [
  { label: 'Sep', value: { value: 34 } },
  { label: 'Oct', value: { value: 41 } },
  { label: 'Nov', value: { value: 38 } },
  { label: 'Dec', value: { value: 52 } },
  { label: 'Jan', value: { value: 61 } },
  { label: 'Feb', value: { value: 58 } },
];

const meta = {
  title: 'UI/TrendLine',
  component: TrendLine,
  args: { data: MONTHS, title: 'Minutes practised' },
} satisfies Meta<typeof TrendLine>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <View className="w-96 bg-surface p-inset">
      <TrendLine {...args} />
    </View>
  ),
};

/**
 * Doc 27 §4: a k-anonymity-suppressed point is NOT a zero and NOT a gap in the
 * data — it is a hole the chart must admit to.
 */
export const WithSuppressedPoints: Story = {
  render: () => (
    <View className="w-96 bg-surface p-inset">
      <TrendLine
        title="Mastery, small cohort"
        data={[
          { label: 'Sep', value: { value: 44 } },
          { label: 'Oct', value: { value: 49 } },
          { label: 'Nov', value: { suppressed: true } },
          { label: 'Dec', value: { suppressed: true } },
          { label: 'Jan', value: { value: 57 } },
          { label: 'Feb', value: { value: 63 } },
        ]}
      />
    </View>
  ),
};

/** `format` shapes the end label and any readout. */
export const FormattedValues: Story = {
  render: () => (
    <View className="w-96 bg-surface p-inset">
      <TrendLine title="Weekly mastery" data={MONTHS} format={(v) => `${v}%`} />
    </View>
  ),
};
