'use client';
// PLATFORM FORK — web. There is no hardware Back press: the browser's Back is
// history navigation and belongs to the router, and the collapsed column step
// on web is driven by on-screen affordances (DetailNavbar's back/close), not
// an intercepted button. A subscription-free no-op also keeps expo-router and
// react-native's BackHandler out of the Next bundle entirely.
// SOT: docs/pack/37-onboarding-dual-pane.md §3.2 · ./README.md (Back behaviour)
// SOT-KEYWORDS: split view back web noop history fork
import type { AdaptivePanesStore } from './store';
import type { SplitNavigableColumn } from './types';

export function useSplitViewBack(_params: {
  collapsed: boolean;
  activeColumn: SplitNavigableColumn;
  columnCount: 1 | 2;
  store: AdaptivePanesStore;
}): void {
  // Intentionally empty — see header.
}
