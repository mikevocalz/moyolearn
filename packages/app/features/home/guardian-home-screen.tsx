'use client';
// Guardian Home — the family feed as the guardian shell's landing tab.
// One card per child (doc 34 session cards + upcoming), the ≤1-tap path to the
// newest report (doc 36 §4.2). Wraps the EXISTING ParentHomeContent — the doc
// 36 §0 move rule: the screen already existed inside the shared home dispatch;
// this file only gives it a shell-owned front door.
// Mobbin: Garmin Connect activity-feed cards (mobbin.com/screens/31580095-08ba-4849-b5dd-23554d4cf6e0) ·
// Oura Today feed (mobbin.com/screens/bce8101b-5be9-4cef-a9c7-e7a9d88d12c6) ·
// Skillshare resume-first hero (mobbin.com/screens/eaa37d84-6ac3-44d2-a888-35e0198919db)
// SOT: docs/pack/36-role-navigation-flows.md §3.2 · docs/pack/34-session-summary-reports.md
// SOT-KEYWORDS: guardian home screen family feed shell landing children cards

import { ScrollView } from '@acme/ui/tw';
import { Container, SafeArea } from '@acme/ui';
import { ParentHomeContent } from './parent-home-content';

export function GuardianHomeScreen() {
  return (
    <SafeArea edges={['top']} className="flex-1 bg-surface">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Container width="detail" className="py-4 pb-48">
          <ParentHomeContent />
        </Container>
      </ScrollView>
    </SafeArea>
  );
}
