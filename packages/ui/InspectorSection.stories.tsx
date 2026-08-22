import type { Meta, StoryObj } from '@storybook/react-vite';
import { InspectorSection } from './InspectorSection';
import { MasteryBar } from './MasteryBar';
import { Text, View } from './primitives';

const meta = {
  title: 'UI/InspectorSection',
  component: InspectorSection,
} satisfies Meta<typeof InspectorSection>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Sections sit at `gap-group` with NO rules between them (doc 08 §4.5) — the
 * collapse affordance and the space do that work. A divider per section would
 * compete with the ink borders that already say "this is a thing", and the
 * inspector would read as a settings table.
 */
export const InspectorPane: Story = {
  args: { title: 'Session', children: null },
  render: () => (
    <View className="w-full max-w-pane-inspector gap-group border-2 border-border bg-surface-raised p-inset">
      <InspectorSection title="Session">
        <Text className="text-body text-text">Long division · 10:00–10:45</Text>
        <Text className="text-body text-text-muted">Room B · in person</Text>
      </InspectorSection>

      <InspectorSection title="Mastery">
        <MasteryBar value={41} label="Long division" state="needs-attention" />
        <MasteryBar value={82} label="Fractions" />
      </InspectorSection>

      <InspectorSection title="Notes" defaultOpen={false}>
        <Text className="text-body text-text">Asked for one more example on remainders.</Text>
      </InspectorSection>
    </View>
  ),
};

/** The whole header row is the target — 44dp of row beats a 16dp glyph. */
export const ClosedByDefault: Story = {
  args: { title: 'Attendance', children: null },
  render: () => (
    <View className="w-full max-w-pane-inspector border-2 border-border bg-surface-raised p-inset">
      <InspectorSection title="Attendance" defaultOpen={false}>
        <Text className="text-body text-text">4 of 4 sessions attended.</Text>
      </InspectorSection>
    </View>
  ),
};
