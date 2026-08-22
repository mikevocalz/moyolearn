import type { Meta, StoryObj } from '@storybook/react-vite';
import { Dial } from './Dial';
import { ScheduleCard } from './ScheduleCard';
import { Text, View } from './primitives';

const meta = { title: 'UI/ScheduleCard', component: ScheduleCard } satisfies Meta<typeof ScheduleCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    time: '09:00–09:45',
    title: 'Amina Okafor',
    meta: ['Fractions · Room B'],
    mode: 'In person',
    primaryAction: { label: 'Start', onPress: () => {} },
    secondaryAction: { label: 'Prep', onPress: () => {} },
  },
  render: (args) => (
    <View className="w-full max-w-content-form bg-surface p-inset">
      <ScheduleCard {...args} />
    </View>
  ),
};

/**
 * Doc 02 §1's content budget, enforced by the type: `meta` is a tuple of one or
 * two strings, so a third row is a compile error rather than a review comment.
 * A card that needs more is describing L2 content and wants a detail surface.
 */
export const TwoMetadataRowsIsTheCeiling: Story = {
  args: {
    time: '10:00–10:45',
    title: 'Daniel Kim',
    meta: ['Long division · Virtual', 'Guardian joining for the last 10 min'],
    mode: 'Virtual',
    primaryAction: { label: 'Start', onPress: () => {} },
  },
  render: (args) => (
    <View className="w-full max-w-content-form bg-surface p-inset">
      <ScheduleCard {...args} />
    </View>
  ),
};

/**
 * `attention` is highlighter, `overdue` a redpen edge — a mark on the session,
 * never on the child (doc 07). Status is never colour alone: each card still
 * reads its own time, title and metadata.
 */
export const Statuses: Story = {
  args: { time: '11:15–12:00', title: 'Priya Raman' },
  render: () => (
    <View className="w-full max-w-content-form gap-stack bg-surface p-inset">
      <ScheduleCard time="09:00–09:45" title="Amina Okafor" meta={['Fractions']} />
      <ScheduleCard
        time="10:00–10:45"
        title="Daniel Kim"
        meta={['Long division']}
        status="attention"
      />
      <ScheduleCard
        time="11:15–12:00"
        title="Priya Raman"
        meta={['Place value · unpaid invoice']}
        status="overdue"
      />
    </View>
  ),
};

/** The dial changes the chrome; the card takes no dial prop of its own. */
export const AtBothDials: Story = {
  args: { time: '13:30–14:15', title: 'Tomás Lima' },
  render: () => (
    <View className="flex-row flex-wrap gap-group bg-surface p-inset">
      {(['cool', 'hot'] as const).map((t) => (
        <Dial key={t} temperature={t}>
          <View className="w-72 gap-stack">
            <Text className="font-mono text-caption uppercase tracking-widest text-text-muted">
              {t}
            </Text>
            <ScheduleCard
              time="13:30–14:15"
              title="Tomás Lima"
              meta={['Word problems · Room C']}
              mode="In person"
              primaryAction={{ label: 'Start', onPress: () => {} }}
            />
          </View>
        </Dial>
      ))}
    </View>
  ),
};
