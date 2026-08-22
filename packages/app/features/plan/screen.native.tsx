// Plan screen — Native fork.
// Platform forks exist so shared code never branches on Platform.OS at runtime.
// SOT: docs/pack/04-screen-briefs.md §S8
// SOT-KEYWORDS: plan screen feature native

import { ScrollView } from '@acme/ui/tw';
import { Container, SafeArea } from '@acme/ui';
import { PlanContent } from './plan-content';

export function PlanScreen() {
  return (
    <SafeArea edges={['top']} className="flex-1 bg-surface">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Container width="detail" className="py-4 pb-48">
          <PlanContent />
        </Container>
      </ScrollView>
    </SafeArea>
  );
}
