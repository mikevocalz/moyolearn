// PLATFORM FORK — localStorage behind the shared shape, absent during SSR.
// Returning null on the server is correct (last-shell.web.ts established the
// rule): the assign surfaces are client components, so SSR renders the empty
// draft and the client's synchronous hydrate lands before anything interactive.
// SOT: design/screens/teacher/teacher.assign/contract.md · features/onboarding/onboarding-storage.web.ts
// SOT-KEYWORDS: assign persistence storage web localstorage fork draft

import { stateStorageOver } from '../onboarding/onboarding-storage.shared.ts';

export const assignStateStorage = stateStorageOver({
  getString: (key) => globalThis.localStorage?.getItem(key) ?? undefined,
  set: (key, value) => globalThis.localStorage?.setItem(key, value),
  remove: (key) => globalThis.localStorage?.removeItem(key),
});
