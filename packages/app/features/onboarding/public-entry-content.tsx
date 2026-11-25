'use client';
// Mobile/tablet public front door — sign-in first, then entry routing.
//
// This replaces the generic persona picker for native builds. It keeps the
// three-box promise language and adds a dev-only QA hatch that never ships.
// SOT: docs/pack/04-screen-briefs.md §S14 · docs/pack/06-auth-onboarding-spec.md §2
// SOT-KEYWORDS: onboarding public entry sign-in handoff guardian tutor owner teacher

import type { ComponentType } from 'react';
import { useRouter } from 'solito/navigation';
import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Button, Heading, MoyoLearnLogo, PressScale } from '@acme/ui';
import { getAuthMode } from '../../providers/session/auth-mode';
import { onboardingPath } from './flow/flow';

/**
 * The QA hatch, or nothing. This is the ONLY place the persona switch is
 * mounted: the `/onboarding/dev` route that used to carry it bare is gone.
 *
 * Loaded with `require` behind a literal `__DEV__` test so Metro drops the
 * component and the fixture personas it imports from a release bundle (see
 * `providers/session/session.tsx` for why the test is spelled out). The auth
 * mode is checked as well: a dev build pointed at the live server has a real
 * session, and a fixture persona written over it is a corrupt session, not QA.
 */
function devPersonaSwitch(): ComponentType | null {
  if (getAuthMode() === 'live') return null;
  if (typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('./dev-persona-switch') as typeof import('./dev-persona-switch');
    return mod.DevPersonaSwitch;
  }
  return null;
}

/** Resolved once at module scope; see `providers/session/session.tsx`. */
const DevPersonaSwitch = devPersonaSwitch();

export function PublicEntryContent() {
  const router = useRouter();

  return (
    <Section className="gap-group p-inset-roomy">
      {/*
        The app's front door showed the product's name only as words. A first
        launch is the one moment the brand has to be a picture — nothing here is
        familiar yet, and the mark is what the icon on the home screen was.

        Decorative on purpose: the h1 below already reads "Welcome to Moyo", so
        a labelled mark makes a screen reader announce the name twice before the
        first sentence.
      */}
      <View className="w-fit">
        <MoyoLearnLogo height={48} aria-hidden />
      </View>
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

      {DevPersonaSwitch ? (
        <View className="gap-stack rounded-card border-2 border-danger bg-surface-sunken p-4">
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
