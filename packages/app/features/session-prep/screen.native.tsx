// SessionPrep screen — Native fork.
// Platform forks exist so shared code never branches on Platform.OS at runtime.
// SOT: docs/pack/04-screen-briefs.md §S5
// SOT-KEYWORDS: session-prep screen feature native

import { ScrollView, View } from '@acme/ui/tw';
import { Container } from '@acme/ui';
import { SessionPrepContent } from './session-prep-content';

export function SessionPrepScreen() {
  return (
    <View className="flex-1 bg-surface">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Container width="detail" className="py-4 pb-48">
          <SessionPrepContent />
        </Container>
      </ScrollView>
    </View>
  );
}
