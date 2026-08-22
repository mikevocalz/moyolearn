'use client';
// SessionPrep screen — Web fork.
// Platform forks exist so shared code never branches on Platform.OS at runtime.
// SOT: docs/pack/04-screen-briefs.md §S5
// SOT-KEYWORDS: session-prep screen feature web

import { Main } from '@acme/ui/tw';
import { Container } from '@acme/ui';
import { SessionPrepContent } from './session-prep-content';

export function SessionPrepScreen() {
  return (
    <Main className="mx-auto min-h-screen w-full max-w-screen-2xl flex-1 bg-surface py-6 pb-48 sm:py-8 sm:pb-48">
      <Container width="detail">
        <SessionPrepContent />
      </Container>
    </Main>
  );
}
