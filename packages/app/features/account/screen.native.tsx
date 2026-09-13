// Delete-account screen (FD-26) — Native fork.
// Platform forks exist so shared code never branches on Platform.OS at runtime.
// SOT: docs/38-front-door-and-flow.md §5A FD-26
// SOT-KEYWORDS: account deletion screen fd-26 native

import { ScrollView, View } from '@acme/ui/tw';
import { Container } from '@acme/ui';
import { DeleteAccountContent } from './delete-account-content';

export function DeleteAccountScreen() {
  return (
    <View className="flex-1 bg-surface">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Container width="detail" className="py-4 pb-48">
          <DeleteAccountContent />
        </Container>
      </ScrollView>
    </View>
  );
}
