'use client';
// Safety queue screen — Web fork.
//
// NO WEB ROUTE POINTS HERE, and that is correct rather than unfinished: doc 28's
// ops shell is already the web home for staff triage, and adding a second URL
// for the same queue would fork where a breach gets worked. The fork exists
// because a `packages/app` screen is universal by construction — the anchor
// resolves to this file everywhere that is not Metro, including Storybook and
// the Next type-check — so it renders the real thing rather than a stub.
// SOT: ./incident-queue-content.tsx · docs/pack/28-crm-spec.md
// SOT-KEYWORDS: safety queue screen web org incident triage container

import { Container } from '@acme/ui';
import { IncidentQueueContent } from './incident-queue-content';

export function SafetyQueueScreen() {
  return (
    <Container width="detail" className="flex-1 py-4">
      <IncidentQueueContent />
    </Container>
  );
}
