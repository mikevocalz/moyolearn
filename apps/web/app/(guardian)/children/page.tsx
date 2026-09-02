// /children — the guardian's child-management hub (guardian.family), the
// same FamilyScreen the mobile guardian Family tab renders. It lives at
// /children rather than /family because `(guardian)/family` already serves
// the guardian home FEED (GuardianHomeScreen) — the nav's Family item pointed
// there and landed parents on the feed instead of their children.
// SOT: packages/app/features/home/family-screen.tsx · apps/web/components/site/nav.ts
// SOT-KEYWORDS: guardian children family page web route hub
import type { Metadata } from 'next';
import { FamilyScreen } from '@acme/app';

export const metadata: Metadata = {
  title: 'Family — Moyo',
  description: 'Children, permissions, and schedules in one place.',
};

export default function GuardianChildrenPage() {
  return <FamilyScreen />;
}
