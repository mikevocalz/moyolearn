// PLATFORM FORK — localStorage behind the shared shape, absent during SSR.
// Returning null on the server is correct (last-shell.web.ts established the
// rule): onboarding flows are client components, so SSR renders the default
// step and the client's synchronous hydrate lands before anything interactive.
// SOT: docs/pack/37-onboarding-dual-pane.md §2 · providers/session/last-shell.web.ts
// SOT-KEYWORDS: onboarding persistence storage web localstorage fork

import { stateStorageOver } from './onboarding-storage.shared.ts';

export const onboardingStateStorage = stateStorageOver({
  getString: (key) => globalThis.localStorage?.getItem(key) ?? undefined,
  set: (key, value) => globalThis.localStorage?.setItem(key, value),
  remove: (key) => globalThis.localStorage?.removeItem(key),
});
