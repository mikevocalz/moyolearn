'use client';
// PLATFORM FORK — native. The default detail pane content when the host gets
// no `detail` prop: expo-router's <Slot />, so a route layout can mount
// AdaptivePanes and let the router drive the trailing pane. This is the ONLY
// runtime expo-router import in the module — isolated in a fork so the web
// build of packages/ui (which does not install expo-router) never resolves it.
// SOT: docs/pack/37-onboarding-dual-pane.md §3.2 · ../adaptive-panes/README.md
// SOT-KEYWORDS: detail slot fork expo-router native default pane
import { Slot } from 'expo-router';

export function DetailSlot() {
  return <Slot />;
}
