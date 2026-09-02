// PLATFORM FORK — MMKV, instance id `assign`, minted for the assignment draft
// store (the onboarding-storage.native.ts arrangement over the shared
// `stateStorageOver` adapter). Its own instance rather than `onboarding`'s
// because a teacher's half-written assignment is teaching data, not a flow
// resume point — clearing one must never clear the other. Synchronous reads,
// so a resumed create form's first render already carries the draft.
// SOT: design/screens/teacher/teacher.assign/contract.md · features/onboarding/onboarding-storage.native.ts
// SOT-KEYWORDS: assign persistence storage native mmkv fork draft

import { createMMKV } from 'react-native-mmkv';
import { stateStorageOver } from '../onboarding/onboarding-storage.shared.ts';

const storage = createMMKV({ id: 'assign' });

export const assignStateStorage = stateStorageOver({
  getString: (key) => storage.getString(key),
  set: (key, value) => storage.set(key, value),
  remove: (key) => storage.remove(key),
});
