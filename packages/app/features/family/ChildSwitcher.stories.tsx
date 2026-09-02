// ChildSwitcher feature stories — J §2 row 10's required set: 1 child
// (hidden), 2–3 children, active state, overflow. Stories seed family.store
// directly so the chips exercise the real selection path, not a story flag.
// SOT-KEYWORDS: child switcher stories chips guardian family store overflow active
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Text, View } from '@acme/ui/tw';
import { CHILDREN } from '../home/parent-home.data';
import { ChildSwitcher } from './child-switcher';
import { useFamilyStore, type ChildSummary } from './family.store';

const meta = { title: 'Family/ChildSwitcher' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const MANY: ChildSummary[] = [
  ...CHILDREN,
  { id: 'sam', name: 'Sam', gradeBand: 'teen', status: 'On track' },
  { id: 'ade', name: 'Ade', gradeBand: 'young', status: 'On track' },
  { id: 'noor', name: 'Noor', gradeBand: 'child', status: 'Needs check-in' },
  { id: 'leo', name: 'Leo', gradeBand: 'teen', status: 'On track' },
];

function Seeded({
  kids,
  selectedLearnerId = null,
}: {
  kids: ChildSummary[];
  selectedLearnerId?: string | null;
}) {
  // Seed once per mount (useState initializer), not per render — re-seeding on
  // every render would undo the selection the chip press just wrote.
  useState(() => useFamilyStore.setState({ children: kids, selectedLearnerId }));
  const selected = useFamilyStore((s) => s.selectedLearnerId);
  return (
    <View className="gap-stack bg-surface p-inset">
      <Text className="font-mono text-caption text-text-muted">
        selectedLearnerId: {selected ?? '(none — first child is active)'}
      </Text>
      <ChildSwitcher />
    </View>
  );
}

/** A single child renders nothing — a picker with no alternative is noise. */
export const OneChildHidden: Story = {
  render: () => <Seeded kids={CHILDREN.slice(0, 1)} />,
};

export const TwoChildren: Story = {
  render: () => <Seeded kids={CHILDREN} />,
};

export const ThreeChildrenActive: Story = {
  render: () => <Seeded kids={MANY.slice(0, 3)} selectedLearnerId="sam" />,
};

/** Six chips overflow the row and scroll horizontally instead of wrapping. */
export const Overflow: Story = {
  render: () => (
    <View className="w-[360px]">
      <Seeded kids={MANY} selectedLearnerId="noor" />
    </View>
  ),
};
