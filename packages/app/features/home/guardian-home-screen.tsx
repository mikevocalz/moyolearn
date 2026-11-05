'use client';
// Guardian Home — the family feed as the guardian shell's landing tab.
// One card per child (doc 34 session cards + upcoming), the ≤1-tap path to the
// newest report (doc 36 §4.2). Wraps the EXISTING ParentHomeContent — the doc
// 36 §0 move rule: the screen already existed inside the shared home dispatch;
// this file only gives it a shell-owned front door. Doc 37 §2 adds the
// one-time "what happens next" card at the top of the feed after onboarding
// completes — a feed card, never a modal, dismissed once and gone for good.
//
// PR #100 puts the family header above the feed: the child switcher fed by the
// real wards read (GET /api/guardian/wards, active guardianships only, never
// the parent-home fixture), the "Upload work for <child>" entry beside it, and
// the active child's recent homework under both. The switcher writes
// `family.store`; everything below reads it, so one selection scopes the whole
// screen (doc 36 §3.2).
// Mobbin: Garmin Connect activity-feed cards (mobbin.com/screens/31580095-08ba-4849-b5dd-23554d4cf6e0) ·
// Oura Today feed (mobbin.com/screens/bce8101b-5be9-4cef-a9c7-e7a9d88d12c6) ·
// Skillshare resume-first hero (mobbin.com/screens/eaa37d84-6ac3-44d2-a888-35e0198919db) ·
// Uxcel Teams — post-onboarding guidance persists as a dismissible dashboard
// card, not a blocking dialog (mobbin.com/flows/d2d155b4-cc57-4346-9f94-c8b5c5f6af72) ·
// Acorns — You/Kid switcher pinned at the top of home re-scopes every section below (mobbin.com/screens/96c15ebb-251f-4261-b474-b4cf3c74d36a)
// SOT: docs/pack/36-role-navigation-flows.md §3.2 · docs/pack/34-session-summary-reports.md · docs/pack/37-onboarding-dual-pane.md §2 · docs/work/pr-100/contract.md §Routes
// SOT-KEYWORDS: guardian home screen family feed shell landing children cards whats next switcher wards homework upload

import { useRouter } from 'solito/navigation';
import { ScrollView, Section, Text as TWText, View } from '@acme/ui/tw';
import { Button, Card, Container, FadeIn, Text } from '@acme/ui';
import { useGuardianWhatsNext } from '../onboarding/guardian/whats-next.store';
import { useActiveChild } from '../family/family.store';
import { GUARDIAN_UPLOAD_PATH } from '../homework/guardian-assign-sheet';
import { GuardianFamilyHeader } from '../homework/guardian-family-header';
import { GuardianHomeworkTimeline } from '../homework/guardian-homework-timeline';
import { ParentHomeContent } from './parent-home-content';

/** The home feed shows the newest few worksheets; the route shows them all. */
const HOME_TIMELINE_LIMIT = 3;

export function GuardianHomeScreen() {
  return (
    <View className="flex-1 bg-surface">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Container width="detail" className="py-4 pb-48">
          <WhatsNextCard />
          <FamilyHeader />
          <ParentHomeContent />
        </Container>
      </ScrollView>
    </View>
  );
}

/**
 * The switcher, the upload entry, and the active child's newest homework.
 * The wards read and its failure states live in GuardianFamilyHeader, shared
 * with the /homework route.
 */
function FamilyHeader() {
  const router = useRouter();
  const child = useActiveChild();

  return (
    <FadeIn>
      <Section className="mb-7 gap-group">
        <GuardianFamilyHeader child={child} />
        <Section className="gap-stack">
          <Text variant="label" tone="muted">Homework</Text>
          <GuardianHomeworkTimeline
            learnerAuthId={child?.id}
            childName={child?.name}
            limit={HOME_TIMELINE_LIMIT}
            onSeeAll={() => router.push('/homework')}
            onUpload={() => router.push(GUARDIAN_UPLOAD_PATH)}
          />
        </Section>
      </Section>
    </FadeIn>
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
