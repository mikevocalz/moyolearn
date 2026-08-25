'use client';
// Memory screen (S27) — Web fork.
// Platform forks exist so shared code never branches on Platform.OS at runtime.
// SOT: docs/pack/07-security-child-ai-safety-spec.md §S27
// SOT-KEYWORDS: memory s27 screen feature web

import { Main } from '@acme/ui/tw';
import { Container } from '@acme/ui';
import { MemoryContent } from './memory-content';

export function MemoryScreen() {
  return (
    <Main className="mx-auto min-h-screen w-full max-w-screen-2xl flex-1 bg-surface py-6 pb-48 sm:py-8 sm:pb-48">
      <Container width="detail">
        <MemoryContent />
      </Container>
    </Main>
  );
}
