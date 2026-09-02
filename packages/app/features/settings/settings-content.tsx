'use client';
// Settings — reached from Profile. Preferences, appearance, and session
// controls live here; identity stays on the profile screen.
import { useRouter } from 'solito/navigation';
import { isBillingRole } from '@acme/auth';
import { Section, View, Pressable } from '@acme/ui/tw';
import { Button, Card, Heading, Switch, Text, FadeIn } from '@acme/ui';
import { authClient, useAppSession } from '../../providers/session';
import { useProfile, type ThemePreference } from '../profile/profile.store';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

function ThemeSegment() {
  const theme = useProfile((s) => s.theme);
  const setTheme = useProfile((s) => s.setTheme);
  return (
    <View className="flex-row gap-1 self-start rounded-lg border-2 border-border bg-surface-sunken p-1">
      {THEME_OPTIONS.map((option) => {
        const active = theme === option.value;
        return (
          <Pressable
            key={option.value}
            role="radio"
            aria-checked={active}
            aria-label={option.label}
            onPress={() => setTheme(option.value)}
            className={`rounded-md px-4 py-1.5 transition-colors duration-fast ${
              active ? 'border-2 border-border-strong bg-primary' : 'hover:bg-surface-raised/60'
            }`}
          >
            <Text variant="caption" className={active ? 'font-semibold text-on-primary' : 'text-text-muted'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SettingsContent({ managePlanHref }: { managePlanHref?: string }) {
  const p = useProfile();
  const router = useRouter();
  const { activeContext, memberships } = useAppSession();

  /*
    RoleShell's `billingOnly` gate, applied the same way here (nav.ts law, one
    resolution, never a second): the owner KIND always passes — an owner IS a
    billing role, and mock personas carry no organizationRole to read — and a
    staff hat passes only when its membership's organizationRole is one
    `isBillingRole` admits (finance). Everyone else gets ABSENCE, never a
    disabled row (sys.settings permission path), which also keeps PW-03b:
    no plan surface ever renders for a learner session.
  */
  const activeMembership = memberships.find((m) => m.orgId === activeContext.orgId);
  const mayBill =
    activeContext.kind === 'owner' || isBillingRole(activeMembership?.organizationRole);

  const signOut = async () => {
    // Replace to the dispatcher, not a login deep-link: the front door (doc 38
    // FD-01/FD-02) owns where an anon session lands on each platform. `finally`
    // so a failed revocation still leaves the settings surface instead of
    // stranding the person on a dead button.
    try {
      await authClient.signOut();
    } finally {
      router.replace('/');
    }
  };

  return (
    <View className="gap-group md:gap-10 lg:gap-12">
      <FadeIn>
        <Section className="gap-1">
          <Heading level={1} size="display-sm">Settings</Heading>
          <Text tone="muted">Notifications, appearance, and your session.</Text>
        </Section>
      </FadeIn>

      <FadeIn delay={80}>
        <Card className="gap-4">
          <View className="gap-1">
            <Text variant="heading">Preferences</Text>
            <Text variant="caption" tone="muted">Notifications and visibility.</Text>
          </View>
          <Switch value={p.notifications} onChange={p.setNotifications} label="Push notifications" />
          <Switch value={p.digest} onChange={p.setDigest} label="Weekly email digest" />
          <Switch value={p.publicProfile} onChange={p.setPublicProfile} label="Public profile" />
        </Card>
      </FadeIn>

      <FadeIn delay={140}>
        <Card className="gap-4">
          <View className="gap-1">
            <Text variant="heading">Appearance</Text>
            <Text variant="caption" tone="muted">Follow the device, or pick a side.</Text>
          </View>
          <ThemeSegment />
        </Card>
      </FadeIn>

      {/*
        DECISION — the plan row is role-gated AND host-gated: it renders only
        when the session may bill (owner/finance, the RoleShell resolution
        above) and the mounting screen supplied the href — the web fork passes
        /settings/org; native passes nothing because no such route exists on
        mobile, and a door to a 404 is worse than absence. Absent, never
        disabled (sys.settings permission law).
      */}
      {mayBill && managePlanHref ? (
        <FadeIn delay={200}>
          <Card className="gap-stack">
            <View className="gap-1">
              <Text variant="heading">Plan</Text>
              <Text variant="caption" tone="muted">Your organization’s plan and billing summary.</Text>
            </View>
            <View className="flex-row">
              <Button
                title="Manage plan"
                variant="outline"
                onPress={() => router.push(managePlanHref)}
              />
            </View>
          </Card>
        </FadeIn>
      ) : null}

      <FadeIn delay={260}>
        <Card className="gap-stack">
          <View className="gap-1">
            <Text variant="heading">Session</Text>
            <Text variant="caption" tone="muted">Sign out on this device only.</Text>
          </View>
          <View className="flex-row gap-stack">
            <Button title="Sign out" variant="outline" onPress={() => { void signOut(); }} />
            {/*
              DECISION — no "Delete account" button: it was a dead control
              (onPress={() => {}}), and FD-26 — the deletion flow this
              contract's exit is declared against — is MISSING (sys.settings
              Status). Absence over a ghost: the row returns WITH FD-26, wired
              to a real flow, not before.
            */}
          </View>
        </Card>
      </FadeIn>
    </View>
  );
}
