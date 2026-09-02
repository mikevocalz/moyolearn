'use client';
// Guardian alerts screen — Native fork. The `(guardian)/(tabs)/alerts` tab
// points here (doc 36 §3.2: Alerts is its own tab, never under a bell).
// SOT: ./guardian-alerts-content.tsx · design/screens/guardian/guardian.alerts/contract.md
// SOT-KEYWORDS: guardian alerts screen native tab incidents container

import { ScrollView } from '@acme/ui/tw';
import { Container, SafeArea } from '@acme/ui';
import { GuardianAlertsContent } from './guardian-alerts-content';

export function GuardianAlertsScreen() {
  return (
    <SafeArea edges={['top']} className="flex-1 bg-surface">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Container width="detail" className="py-4 pb-48">
          <GuardianAlertsContent />
        </Container>
      </ScrollView>
    </SafeArea>
  );
}
