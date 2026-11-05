// Signature S1 in isolation, so web-designer-pro's filmstrip can freeze its
// frames without a database behind the share route.
// SOT: DIRECTION.md §Signatures S1
// SOT-KEYWORDS: movement meter stories signature filmstrip
import type { Meta, StoryObj } from '@storybook/react-vite';
import { View } from '@acme/ui/tw';
import { MovementMeter } from './movement-meter';

const meta = { title: 'Summary/MovementMeter', component: MovementMeter } satisfies Meta<
  typeof MovementMeter
>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A session that moved fractions from developing to proficient. */
export const Grew: Story = {
  args: {
    label: 'Adding fractions with unlike denominators',
    beforeP: 0.42,
    afterP: 0.71,
    state: 'steady',
    levelLine: 'Developing → Proficient',
    positionCopy: 'Most fourth graders are building toward this skill this term.',
  },
  render: (args) => (
    <View className="bg-surface p-inset" style={{ maxWidth: 560 }}>
      <MovementMeter {...args} />
    </View>
  ),
};

/** Still under half after the session: the attention fill, and no shame in the copy. */
export const StillBuilding: Story = {
  args: {
    label: 'Long division with remainders',
    beforeP: 0.18,
    afterP: 0.34,
    state: 'needs-attention',
    levelLine: 'Beginning → Developing',
    positionCopy: 'This one usually lands in fifth grade, so there is time.',
  },
  render: Grew.render,
};

/** The estimate dipped: no growth to animate, the after fill drawn solid, the level line says what changed. */
export const Dipped: Story = {
  args: {
    label: 'Comparing decimals',
    beforeP: 0.63,
    afterP: 0.58,
    state: 'steady',
    levelLine: 'Proficient → Proficient',
    positionCopy: 'Right where most fifth graders are this term.',
  },
  render: Grew.render,
};
