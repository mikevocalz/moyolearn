'use client';
// Delete-account screen (FD-26) — Web fork.
// Platform forks exist so shared code never branches on Platform.OS at runtime.
// SOT: docs/38-front-door-and-flow.md §5A FD-26
// SOT-KEYWORDS: account deletion screen fd-26 web

import { Main } from '@acme/ui/tw';
import { Container } from '@acme/ui';
import { DeleteAccountContent } from './delete-account-content';

export function DeleteAccountScreen() {
  return (
    <Main className="mx-auto min-h-screen w-full max-w-screen-2xl flex-1 bg-surface py-6 pb-48 sm:py-8 sm:pb-48">
      <Container width="detail">
        <DeleteAccountContent />
      </Container>
    </Main>
  );
}
