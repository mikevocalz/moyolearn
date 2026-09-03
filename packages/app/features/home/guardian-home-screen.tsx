'use client';
// Guardian Home — the family feed as the guardian shell's landing tab.
// One card per child (doc 34 session cards + upcoming), the ≤1-tap path to the
// newest report (doc 36 §4.2). Wraps the EXISTING ParentHomeContent — the doc
// 36 §0 move rule: the screen already existed inside the shared home dispatch;
// this file only gives it a shell-owned front door. Doc 37 §2 adds the
// one-time "what happens next" card at the top of the feed after onboarding
// completes — a feed card, never a modal, dismissed once and gone for good.
// Mobbin: Garmin Connect activity-feed cards (mobbin.com/screens/31580095-08ba-4849-b5dd-23554d4cf6e0) ·
// Oura Today feed (mobbin.com/screens/bce8101b-5be9-4cef-a9c7-e7a9d88d12c6) ·
// Skillshare resume-first hero (mobbin.com/screens/eaa37d84-6ac3-44d2-a888-35e0198919db) ·
// Uxcel Teams — post-onboarding guidance persists as a dismissible dashboard
// card, not a blocking dialog (mobbin.com/flows/d2d155b4-cc57-4346-9f94-c8b5c5f6af72)
// SOT: docs/pack/36-role-navigation-flows.md §3.2 · docs/pack/34-session-summary-reports.md · docs/pack/37-onboarding-dual-pane.md §2
// SOT-KEYWORDS: guardian home screen family feed shell landing children cards whats next

import { ScrollView, Text as TWText, View } from '@acme/ui/tw';
import { Button, Card, Container, FadeIn } from '@acme/ui';
import { useGuardianWhatsNext } from '../onboarding/guardian/whats-next.store';
import { ParentHomeContent } from './parent-home-content';

export function GuardianHomeScreen() {
  return (
    <View className="flex-1 bg-surface">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Container width="detail" className="py-4 pb-48">
          <WhatsNextCard />
          <ParentHomeContent />
        </Container>
      </ScrollView>
    </View>
  );
}

/**
 * Shown exactly once, after the guardian flow completes (the flow arms it —
 * whats-next.store.ts). It answers the only two questions a guardian has the
 * moment onboarding ends: what does my child do, and when do I hear back. In
 * the feed rather than over it: a modal would gate the feed the flow just
 * promised, and the card's whole message is "nothing needs you right now".
 */
function WhatsNextCard() {
  const phase = useGuardianWhatsNext((s) => s.phase);
  const dismiss = useGuardianWhatsNext((s) => s.dismiss);
  if (phase !== 'eligible') return null;

  return (
    <FadeIn>
      <Card className="mb-4 gap-stack">
        <TWText className="text-title font-semibold text-text">What happens next</TWText>
        <TWText className="text-body text-text">
          Your child opens Moyo on their device and signs in with the code — nothing else to set
          up on their side.
        </TWText>
        <TWText className="text-body text-text">
          After their first session, their first report lands right here in this feed.
        </TWText>
        <Button variant="ghost" title="Got it" onPress={dismiss} />
      </Card>
    </FadeIn>
  );
}
