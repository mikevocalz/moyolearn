'use client';
// Mobile/tablet public front door — sign-in first, then entry routing.
//
// This replaces the generic persona picker for native builds. It keeps the
// three-box promise language and adds a dev-only QA hatch that never ships.
// SOT: docs/pack/04-screen-briefs.md §S14 · docs/pack/06-auth-onboarding-spec.md §2
// SOT-KEYWORDS: onboarding public entry sign-in handoff guardian tutor owner teacher

import { useRouter } from 'solito/navigation';
import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Button, Heading, PressScale } from '@acme/ui';
import { onboardingPath } from './flow/flow';
import { DevPersonaSwitch } from './dev-persona-switch';

export function PublicEntryContent() {
  const router = useRouter();

  return (
    <Section className="gap-group p-inset-roomy">
      <View className="gap-stack">
        <Heading level={1} size="title">
          Welcome to Moyo
        </Heading>
        <TWText className="text-body text-text">
          We keep three things in separate boxes: your child&apos;s learning,
          your account, and our service data.
        </TWText>
      </View>

      <View className="gap-stack">
        <Button
          title="Sign in to Moyo"
          onPress={() => router.push('/onboarding/sign-in')}
          fullWidth
          size="lg"
        />
      </View>

      <View className="gap-stack">
        <TWText className="text-center text-label text-text-muted">
          Or, if you are starting here, choose your setup path:
        </TWText>
        <EntryOption
          label="I have a handoff code"
          // The canonical redemption route (mobile app/handoff.tsx, web
          // (auth)/handoff) — the /onboarding/handoff duplicate is deleted.
          onPress={() => router.push('/handoff')}
        />
        <EntryOption
          label="Set up my family"
          onPress={() => router.push(onboardingPath('guardian'))}
        />
        <EntryOption
          label="Set up my tutoring profile"
          onPress={() => router.push(onboardingPath('tutor'))}
        />
        <EntryOption
          label="Set up a tutoring business"
          onPress={() => router.push(onboardingPath('owner'))}
        />
        <EntryOption
          label="Set up a class"
          onPress={() => router.push(onboardingPath('teacher'))}
        />
      </View>

      {__DEV__ ? (
        <View className="gap-stack rounded-card border-2 border-danger bg-surface-sunken p-4">
          <Heading level={2} size="title" className="text-danger">
            Development only
          </Heading>
          <TWText className="text-body text-text">
            For QA and design review.
          </TWText>
          <DevPersonaSwitch />
        </View>
      ) : null}
    </Section>
  );
}

function EntryOption({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <PressScale
      onPress={onPress}
      className="w-full rounded-card border-2 border-border bg-surface-raised p-4"
      outerClassName="w-full"
    >
      <TWText className="text-base font-semibold text-text">{label}</TWText>
    </PressScale>
  );
}
