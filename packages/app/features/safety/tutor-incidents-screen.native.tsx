'use client';
// Tutor incidents screen — Native fork.
//
// NO NATIVE ROUTE POINTS HERE, and that is correct rather than unfinished:
// the contract is explicit that tutor.incidents ships as a web sidebar item
// with no mobile tab, the exact inverse of `screen.web.tsx` beside it (where
// the web route is the one that does not exist). The fork exists because a
// `packages/app` screen is universal by construction — the anchor resolves to
// a file on Metro too — so it renders the real thing rather than a stub, and
// a future mobile surface reads the same projections (contract
// cross_device_continuity).
// SOT: ./tutor-incidents-content.tsx · design/screens/tutor/tutor.incidents/contract.md
// SOT-KEYWORDS: tutor incidents screen native fork no route web first

import { ScrollView } from '@acme/ui/tw';
import { Container, SafeArea } from '@acme/ui';
import { TutorIncidentsContent } from './tutor-incidents-content';

export function TutorIncidentsScreen() {
  return (
    <SafeArea edges={['top']} className="flex-1 bg-surface">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Container width="detail" className="py-4 pb-48">
          <TutorIncidentsContent />
        </Container>
      </ScrollView>
    </SafeArea>
  );
}
