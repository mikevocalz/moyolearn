'use client';
// Onboarding flow screen — Web fork.
// Platform forks exist so shared code never branches on Platform.OS at runtime.
// SOT: docs/pack/06-auth-onboarding-spec.md §5
// SOT-KEYWORDS: onboarding flow screen feature web

import { Main } from '@acme/ui/tw';
import { Container } from '@acme/ui';
import { OnboardingFlowContent } from './flow-content';

export function OnboardingFlowScreen({ flow }: { flow: string }) {
  return (
    <Main className="mx-auto min-h-screen w-full max-w-screen-2xl flex-1 bg-surface py-6 pb-48 sm:py-8 sm:pb-48">
      <Container width="detail">
        <OnboardingFlowContent flow={flow} />
      </Container>
    </Main>
  );
}
