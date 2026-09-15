// PLATFORM FORK — localStorage behind the shared shape, absent during SSR.
// Same rule as onboarding's fork: the checklist is a client component, so SSR
// renders the unasked defaults and the client's synchronous hydrate lands
// before anything is interactive.
// SOT: packages/app/features/onboarding/onboarding-storage.web.ts
// SOT-KEYWORDS: permissions persistence storage web localstorage fork

import { stateStorageOver } from '../onboarding/onboarding-storage.shared.ts';

export const permissionsStateStorage = stateStorageOver({
  getString: (key) => globalThis.localStorage?.getItem(key) ?? undefined,
  set: (key, value) => globalThis.localStorage?.setItem(key, value),
  remove: (key) => globalThis.localStorage?.removeItem(key),
});
