'use client';
// PLATFORM FORK — web. apps/web has no expo-router, so there is no router
// slot to fall back to: a web host must supply `detail` (Storybook and the
// Next pages both do). Rendering nothing rather than throwing keeps a
// detail-less host a layout choice, not a crash.
// SOT: docs/pack/37-onboarding-dual-pane.md §3.2 · ../adaptive-panes/README.md
// SOT-KEYWORDS: detail slot fork web empty no router
export function DetailSlot() {
  return null;
}
