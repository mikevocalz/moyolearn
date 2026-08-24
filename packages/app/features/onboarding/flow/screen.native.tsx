// Onboarding flow screen — Native fork.
// Platform forks exist so shared code never branches on Platform.OS at runtime.
// SOT: docs/pack/06-auth-onboarding-spec.md §5
// SOT-KEYWORDS: onboarding flow screen feature native

import { ScrollView } from '@acme/ui/tw';
import { Container, SafeArea } from '@acme/ui';
import { OnboardingFlowContent } from './flow-content';

export function OnboardingFlowScreen({ flow }: { flow: string }) {
  return (
    <SafeArea edges={['top']} className="flex-1 bg-surface">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Container width="detail" className="py-4 pb-48">
          <OnboardingFlowContent flow={flow} />
        </Container>
      </ScrollView>
    </SafeArea>
  );
}
