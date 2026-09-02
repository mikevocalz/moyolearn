// /teachers/conference — the Conference Hub on web. ADR-102 demotes
// Conferences from a tab to a surface reached from teacher Home; mobile
// mounts the same screen at `(teacher)/conference`, and the fork pair in
// features/conference/conference-paths keeps the two hrefs in one place.
// SOT: docs/decisions/adr-102-teacher-shell-ia.md · packages/app/features/conference/hub-screen.tsx
// SOT-KEYWORDS: conference page route teacher web hub schedule
import type { Metadata } from 'next';
import { ConferenceHubScreen } from '@acme/app';

export const metadata: Metadata = {
  title: 'Conferences — Moyo',
  description: 'Upcoming and scheduled conferences.',
};

export default function TeacherConferencePage() {
  return <ConferenceHubScreen />;
}
