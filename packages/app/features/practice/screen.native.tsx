// Practice screen — Native fork.
// Platform forks exist so shared code never branches on Platform.OS at runtime.
// SOT: docs/pack/04-screen-briefs.md §S10
// SOT-KEYWORDS: practice screen feature native

import { ScrollView } from '@acme/ui/tw';
import { Container, SafeArea } from '@acme/ui';
import { PracticeContent } from './practice-content';

export function PracticeScreen() {
  return (
    <SafeArea edges={['top']} className="flex-1 bg-surface">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Container width="detail" className="py-4 pb-48">
          <PracticeContent />
        </Container>
      </ScrollView>
    </SafeArea>
  );
}
