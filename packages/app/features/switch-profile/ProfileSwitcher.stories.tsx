// ProfileSwitcher feature stories — J §2 row 8's required set: 1/2/3 learners,
// the locked Grown-ups row, and the unlock flow states. Stories seed
// family.store and the gate store directly so the rows exercise the real
// switch/verify paths; `grownUps` stands in for the AuthPort seam.
// SOT-KEYWORDS: profile switcher stories fd-24 who's here grown-ups locked verifying failed
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SheetSurface } from '@acme/ui';
import { Text, View } from '@acme/ui/tw';
import { CHILDREN } from '../home/parent-home.data';
import { useFamilyStore, type ChildSummary } from '../family/family.store';
import { ProfileSwitcher } from './profile-switcher';
import { useProfileSwitcherStore, type GrownUpsGate } from './profile-switcher.store';

const meta = { title: 'SwitchProfile/ProfileSwitcher' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const THREE: ChildSummary[] = [
  ...CHILDREN,
  { id: 'sam', name: 'Sam', gradeBand: 'teen', status: 'On track' },
];

/** Verification that never resolves — freezes the gate for state inspection. */
const NEVER_RESOLVES = () => new Promise<boolean>(() => {});

function Seeded({
  learners,
  gate = { kind: 'locked' },
  verifyGrownUp,
}: {
  learners: ChildSummary[];
  gate?: GrownUpsGate;
  verifyGrownUp: () => Promise<boolean>;
}) {
  // Seed once per mount (useState initializer), not per render — re-seeding on
  // every render would fight the state the interaction just wrote.
  useState(() => {
    useFamilyStore.setState({ children: learners, selectedLearnerId: null });
    useProfileSwitcherStore.setState({ gate });
  });
  const liveGate = useProfileSwitcherStore((s) => s.gate);
  return (
    <View className="max-w-md gap-stack bg-surface p-inset">
      <Text className="font-mono text-caption text-text-muted">gate: {liveGate.kind}</Text>
      {/* The header is chrome, so the bare render borrows the same surface the
          sheet uses rather than growing a second copy of the title. */}
      <SheetSurface title="Who's here?">
        <ProfileSwitcher grownUps={{ kind: 'present', verify: verifyGrownUp }} />
      </SheetSurface>
    </View>
  );
}

export const OneLearner: Story = {
  render: () => <Seeded learners={CHILDREN.slice(0, 1)} verifyGrownUp={NEVER_RESOLVES} />,
};

export const TwoLearners: Story = {
  render: () => <Seeded learners={CHILDREN} verifyGrownUp={NEVER_RESOLVES} />,
};

export const ThreeLearners: Story = {
  render: () => <Seeded learners={THREE} verifyGrownUp={NEVER_RESOLVES} />,
};

/** Pressing Grown-ups holds in `verifying` — the check never returns here. */
export const UnlockVerifying: Story = {
  render: () => (
    <Seeded learners={CHILDREN} gate={{ kind: 'verifying' }} verifyGrownUp={NEVER_RESOLVES} />
  ),
};

/** A failed PIN reads as "try again", never as an unlocked row. */
export const UnlockFailed: Story = {
  render: () => (
    <Seeded
      learners={CHILDREN}
      gate={{ kind: 'failed' }}
      verifyGrownUp={() => Promise.resolve(false)}
    />
  ),
};

/** Live path: press Grown-ups and the (stubbed) check succeeds after a beat. */
export const UnlockSucceeds: Story = {
  render: () => (
    <Seeded
      learners={CHILDREN}
      verifyGrownUp={() => new Promise((resolve) => setTimeout(() => resolve(true), 900))}
    />
  ),
};
