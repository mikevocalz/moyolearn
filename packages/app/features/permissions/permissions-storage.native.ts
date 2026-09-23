// PLATFORM FORK — MMKV, its own instance id. Synchronous reads, so a checklist
// renders on the saved statuses instead of flashing "not asked yet" and
// correcting itself a frame later — the same requirement onboarding's fork
// exists for, and the same arrangement.
// SOT: packages/app/features/onboarding/onboarding-storage.native.ts
// SOT-KEYWORDS: permissions persistence storage native mmkv fork

import { createMMKV } from 'react-native-mmkv';
import { stateStorageOver } from '../onboarding/onboarding-storage.shared.ts';

const storage = createMMKV({ id: 'permissions' });

export const permissionsStateStorage = stateStorageOver({
  getString: (key) => storage.getString(key),
  set: (key, value) => storage.set(key, value),
  remove: (key) => storage.remove(key),
});
