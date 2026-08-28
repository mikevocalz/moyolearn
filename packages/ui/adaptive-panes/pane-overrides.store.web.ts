'use client';
// PLATFORM FORK — localStorage behind MMKV's shape, absent during SSR. Empty
// overrides on the server are correct: automatic pane policy is always a safe
// layout, and the saved map applies on hydration — the same posture the
// last-shell web fork established for saved-vs-SSR state.
// SOT: ./pane-overrides.store.shared.ts · ./README.md
// SOT-KEYWORDS: pane overrides web localstorage fork persistence ssr
import { createPaneOverrideStore } from './pane-overrides.store.shared.ts';

export const usePaneOverrideStore = createPaneOverrideStore({
  getString: (key) => globalThis.localStorage?.getItem(key) ?? undefined,
  set: (key, value) => globalThis.localStorage?.setItem(key, value),
  remove: (key) => globalThis.localStorage?.removeItem(key),
});
