import type { Meta, StoryObj } from '@storybook/react-vite';
import { AvatarSheet, AvatarSheetSurface, type AvatarSheetSection } from './AvatarSheet';
import { Avatar } from './Avatar';
import { Text, View } from './primitives';
import { Bell, CreditCard, LogOut, Settings } from './icons';

// Chrome-only fixtures: real content (roles × memberships, the live switcher,
// sign-out wiring) is assembled app-side in
// packages/app/features/profile/account-sheet-content.tsx — its stories cover
// the per-role matrix. These exercise the slots and both dial densities.

function Identity({ name, noun }: { name: string; noun: string }) {
  return (
    <View className="flex-row items-center gap-stack">
      {/* Role accent as the avatar ring — a fill behind the avatar (the
          role-accent gate bans border- prefixes on role tokens everywhere). */}
      <View className="rounded-md bg-role-accent p-0.5">
        <Avatar name={name} size="lg" />
      </View>
      <View className="flex-1 gap-1">
        <Text className="text-body-lg font-semibold text-text">{name}</Text>
        <Text className="text-caption text-text-muted">{noun}</Text>
      </View>
    </View>
  );
}

const rowsFixture = (withPlan: boolean): AvatarSheetSection[] => [
  {
    key: 'account',
    title: 'Account',
    rows: [
      {
        key: 'settings',
        label: 'Profile & settings',
        icon: <Settings size={20} className="text-text-muted" />,
        onPress: () => {},
      },
      ...(withPlan
        ? [
            {
              key: 'plan',
              label: 'Plan & billing',
              icon: <CreditCard size={20} className="text-text-muted" />,
              onPress: () => {},
            },
          ]
        : []),
      {
        key: 'notifications',
        label: 'Notification prefs',
        icon: <Bell size={20} className="text-text-muted" />,
        onPress: () => {},
      },
    ],
  },
  {
    key: 'session',
    rows: [
      {
        key: 'sign-out',
        label: 'Sign out',
        icon: <LogOut size={20} className="text-text-muted" />,
        trailing: null,
        onPress: () => {},
      },
    ],
  },
];

const meta = {
  title: 'UI/AvatarSheet',
  component: AvatarSheet,
  args: {
    open: true,
    onClose: () => {},
    identity: <Identity name="Nina Alvarez" noun="Parent" />,
    sections: rowsFixture(true),
  },
} satisfies Meta<typeof AvatarSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

// RN Modal portals outside the story canvas — the inline surface stories below
// are the reliable visual reference; these two exercise the modal wiring.
export const Open: Story = {};
export const Closed: Story = { args: { open: false } };

export const GuardianSurface: Story = {
  render: () => (
    <AvatarSheetSurface
      temperature="hot"
      identity={<Identity name="Nina Alvarez" noun="Parent" />}
      sections={rowsFixture(true)}
    />
  ),
};

export const CoolStaffSurface: Story = {
  render: () => (
    <AvatarSheetSurface
      temperature="cool"
      identity={<Identity name="Marcus Webb" noun="Staff" />}
      sections={rowsFixture(false)}
    />
  ),
};

// The switcher slot sits between identity and rows — one gesture from the
// avatar (the Slack lesson in ADR-106). A placeholder stands in for the live
// ContextSwitcher, which is app-side state.
export const SwitcherSlot: Story = {
  render: () => (
    <AvatarSheetSurface
      temperature="cool"
      identity={<Identity name="Priya Nair" noun="Tutor" />}
      sections={rowsFixture(false)}
    >
      <View className="gap-element rounded-md border-2 border-border bg-surface-sunken p-inset">
        <Text className="text-caption text-text-muted">Switch context</Text>
        <Text className="text-body text-text">Bright Minds Tutoring · Tutor</Text>
        <Text className="text-body text-text-muted">Maya&apos;s parent</Text>
      </View>
    </AvatarSheetSurface>
  ),
};

// ADR-106 band law: the 6–8/9–12 learner sheet is the identity header alone —
// no settings, no plan, no sign out (guardian-managed device).
export const LearnerMinimalSurface: Story = {
  render: () => (
    <AvatarSheetSurface temperature="hot" identity={<Identity name="Maya Alvarez" noun="Learner" />} />
  ),
};

export const SignOutPendingSurface: Story = {
  render: () => (
    <AvatarSheetSurface
      temperature="cool"
      identity={<Identity name="Marcus Webb" noun="Staff" />}
      sections={[
        {
          key: 'session',
          rows: [
            {
              key: 'sign-out',
              label: 'Signing out…',
              icon: <LogOut size={20} className="text-text-muted" />,
              trailing: null,
              disabled: true,
              onPress: () => {},
            },
          ],
        },
      ]}
    />
  ),
};
