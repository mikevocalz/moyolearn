// ChildSwitcher feature stories — J §2 row 10's required set: 1 child
// (hidden), 2–3 children, active state, overflow. Stories seed family.store
// directly so the chips exercise the real selection path, not a story flag.
//
// The seed rows are shaped like GET /api/guardian/wards rows after
// `wardToChild` (id = learnerAuthId, name = displayName, gradeBand), not the
// retired parent-home fixture: the store's type no longer carries a `status`
// string, because the server never sends one.
// SOT-KEYWORDS: child switcher stories chips guardian family store overflow active
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useInstanceStore } from '@acme/ui';
import { Text, View } from '@acme/ui/tw';
import { ChildSwitcher } from './child-switcher';
import { useFamilyStore, type ChildSummary } from './family.store';

const meta = { title: 'Family/ChildSwitcher' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const WARDS: ChildSummary[] = [
  { id: 'auth-maya', name: 'Maya', gradeBand: 'young' },
  { id: 'auth-jordan', name: 'Jordan', gradeBand: 'child' },
  { id: 'auth-sam', name: 'Sam', gradeBand: 'teen' },
  { id: 'auth-ade', name: 'Ade', gradeBand: 'young' },
  { id: 'auth-noor', name: 'Noor', gradeBand: 'child' },
  { id: 'auth-leo', name: 'Leo', gradeBand: 'teen' },
];

function Seeded({
  kids,
  selectedLearnerId = null,
}: {
  kids: ChildSummary[];
  selectedLearnerId?: string | null;
}) {
  // Seed once per mount (the kit's instance-store initializer runs once), not
  // per render — re-seeding on every render would undo the selection the chip
  // press just wrote.
  useInstanceStore(() => {
    useFamilyStore.setState({ children: kids, selectedLearnerId });
    return { seeded: true };
  });
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

/**
 * Zero children — the state a device is in before the wards read answers.
 * Renders the same nothing `OneChildHidden` does, by the same
 * `children.length < 2` rule. Pinned because "renders nothing" is the correct
 * behaviour here and a future read wiring should not change it by accident.
 */
export const NoChildren: Story = {
  render: () => <Seeded kids={[]} />,
};

/** A single child renders nothing — a picker with no alternative is noise. */
export const OneChildHidden: Story = {
  render: () => <Seeded kids={WARDS.slice(0, 1)} />,
};

export const TwoChildren: Story = {
  render: () => <Seeded kids={WARDS.slice(0, 2)} />,
};

export const ThreeChildrenActive: Story = {
  render: () => <Seeded kids={WARDS.slice(0, 3)} selectedLearnerId="auth-sam" />,
};

/** Six chips overflow the row and scroll horizontally instead of wrapping. */
export const Overflow: Story = {
  render: () => (
    <View className="w-[360px]">
      <Seeded kids={WARDS} selectedLearnerId="auth-noor" />
    </View>
  ),
};
