'use client';
// Safety queue screen — Native fork. The org companion's fourth tab (doc 36
// §3.4). `edges={['top']}` is absent on purpose: `ShellHeader` already owns the
// status bar for every route in this shell, so claiming it again would inset the
// list twice.
// SOT: ./incident-queue-content.tsx · docs/pack/36-role-navigation-flows.md §3.4
// SOT-KEYWORDS: safety queue screen native org incident triage tab

import { SafeArea } from '@acme/ui';
import { IncidentQueueContent } from './incident-queue-content';

export function SafetyQueueScreen() {
  return (
    <SafeArea edges={['bottom']} className="flex-1 bg-surface">
      <IncidentQueueContent />
    </SafeArea>
  );
}
