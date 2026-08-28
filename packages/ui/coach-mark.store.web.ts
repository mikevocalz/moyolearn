'use client';
// PLATFORM FORK — localStorage behind MMKV's shape, absent during SSR. An empty
// map on the server would render a tip into the HTML and then remove it on
// hydration, so `CoachMark` gates its first paint on `useHydrated()` instead of
// this fork guessing: the saved answer arrives with hydration either way.
// SOT: ./coach-mark.store.shared.ts · packages/ui/adaptive-panes/pane-overrides.store.web.ts
// SOT-KEYWORDS: coach mark web localstorage fork persistence ssr seen once tip
import { createCoachMarkStore } from './coach-mark.store.shared.ts';

export const useCoachMarkStore = createCoachMarkStore({
  getString: (key) => globalThis.localStorage?.getItem(key) ?? undefined,
  set: (key, value) => globalThis.localStorage?.setItem(key, value),
  remove: (key) => globalThis.localStorage?.removeItem(key),
});
