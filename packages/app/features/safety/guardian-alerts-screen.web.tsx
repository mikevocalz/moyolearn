'use client';
// Guardian alerts screen — Web fork. `/alerts` under `(guardian)` points
// here; the guardian top-nav's Alerts item is this surface (nav.ts).
// SOT: ./guardian-alerts-content.tsx · design/screens/guardian/guardian.alerts/contract.md
// SOT-KEYWORDS: guardian alerts screen web incidents container

import { Main } from '@acme/ui/tw';
import { Container } from '@acme/ui';
import { GuardianAlertsContent } from './guardian-alerts-content';

export function GuardianAlertsScreen() {
  return (
    <Main className="mx-auto min-h-screen w-full max-w-screen-2xl flex-1 bg-surface py-6 pb-48 sm:py-8 sm:pb-48">
      <Container width="detail">
        <GuardianAlertsContent />
      </Container>
    </Main>
  );
}
