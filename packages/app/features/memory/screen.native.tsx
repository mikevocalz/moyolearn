// Memory screen (S27) — Native fork.
// Platform forks exist so shared code never branches on Platform.OS at runtime.
// SOT: docs/pack/07-security-child-ai-safety-spec.md §S27
// SOT-KEYWORDS: memory s27 screen feature native

import { ScrollView } from '@acme/ui/tw';
import { Container, SafeArea } from '@acme/ui';
import { MemoryContent } from './memory-content';

export function MemoryScreen() {
  return (
    <SafeArea edges={['top']} className="flex-1 bg-surface">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Container width="detail" className="py-4 pb-48">
          <MemoryContent />
        </Container>
      </ScrollView>
    </SafeArea>
  );
}
