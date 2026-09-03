'use client';
// Safety queue screen — Native fork. The org companion's fourth tab (doc 36
// §3.4). It claims NEITHER inset, which is the shell contract: `ShellHeader`
// owns the status bar for every route in this shell and `ShellTabBar` pads
// itself by `insets.bottom`, so a screen that claims either one insets the list
// twice. (It used to claim the bottom edge and push the list off the tab bar.)
// SOT: ./incident-queue-content.tsx · docs/pack/36-role-navigation-flows.md §3.4
// SOT-KEYWORDS: safety queue screen native org incident triage tab inset shell contract

import { View } from '@acme/ui/tw';
import { IncidentQueueContent } from './incident-queue-content';

export function SafetyQueueScreen() {
  return (
    <View className="flex-1 bg-surface">
      <IncidentQueueContent />
    </View>
  );
}
