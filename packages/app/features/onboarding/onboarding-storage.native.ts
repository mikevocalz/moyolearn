// PLATFORM FORK — MMKV, instance id `onboarding`, one instance for every
// onboarding-flow store (each store keys its own blob). Same arrangement as
// last-shell.native.ts and pane-overrides.store.ts: synchronous reads, so the
// resumed flow's first render is already on the saved step.
// SOT: docs/pack/37-onboarding-dual-pane.md §2 · providers/session/last-shell.native.ts
// SOT-KEYWORDS: onboarding persistence storage native mmkv fork

import { createMMKV } from 'react-native-mmkv';
import { stateStorageOver } from './onboarding-storage.shared.ts';

const storage = createMMKV({ id: 'onboarding' });

export const onboardingStateStorage = stateStorageOver({
  getString: (key) => storage.getString(key),
  set: (key, value) => storage.set(key, value),
  remove: (key) => storage.remove(key),
});
