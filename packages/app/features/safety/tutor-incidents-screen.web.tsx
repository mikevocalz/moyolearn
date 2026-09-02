'use client';
// Tutor incidents screen — Web fork. The real surface: tutor.incidents is
// web-first by contract (doc 36 §3.3 puts it in the tutor web sidebar's second
// group; there is no mobile tab), and `/incidents` under `(site)` points here.
// SOT: ./tutor-incidents-content.tsx · design/screens/tutor/tutor.incidents/contract.md
// SOT-KEYWORDS: tutor incidents screen web filed lifecycle container

import { Main } from '@acme/ui/tw';
import { Container } from '@acme/ui';
import { TutorIncidentsContent } from './tutor-incidents-content';

export function TutorIncidentsScreen() {
  return (
    <Main className="mx-auto min-h-screen w-full max-w-screen-2xl flex-1 bg-surface py-6 pb-48 sm:py-8 sm:pb-48">
      <Container width="detail">
        <TutorIncidentsContent />
      </Container>
    </Main>
  );
}
