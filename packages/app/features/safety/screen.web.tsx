'use client';
// Safety queue screen — Web fork. A WEB ROUTE POINTS HERE NOW: `/safety` under
// `(business)` renders this inside the org Cool shell (RoleShell, owner/staff),
// off the rail's Safety group — the surface D-inventory recorded as MISSING.
// The earlier claim that the ops shell was the web home for triage retired with
// it: `/ops` remains the CRM/overview blob, and this route is where a breach
// gets worked, on the safety side of the doc 23/31 wall.
// SOT: ./org-safety-content.tsx · design/screens/org/org.safety/contract.md · docs/pack/36-role-navigation-flows.md §3.4
// SOT-KEYWORDS: safety queue screen web org incident triage container rail

import { Main } from '@acme/ui/tw';
import { Container } from '@acme/ui';
import { OrgSafetyContent } from './org-safety-content';

export function SafetyQueueScreen() {
  return (
    <Main className="mx-auto min-h-screen w-full max-w-screen-2xl flex-1 bg-surface py-6 pb-48 sm:py-8 sm:pb-48">
      <Container width="detail">
        <OrgSafetyContent />
      </Container>
    </Main>
  );
}
