// AiActivity screen — Native fork.
// Platform forks exist so shared code never branches on Platform.OS at runtime.
// SOT: docs/pack/04-screen-briefs.md §S12
// SOT-KEYWORDS: ai-activity screen feature native

import { ScrollView, View } from '@acme/ui/tw';
import { Container } from '@acme/ui';
import { AiActivityContent } from './ai-activity-content';

export function AiActivityScreen() {
  return (
    <View className="flex-1 bg-surface">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Container width="detail" className="py-4 pb-48">
          <AiActivityContent />
        </Container>
      </ScrollView>
    </View>
  );
}
