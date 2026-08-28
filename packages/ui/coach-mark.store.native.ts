'use client';
// PLATFORM FORK — MMKV, instance id `coach-marks`, key `coach-marks-seen`, as a
// JSON blob of the id→true map. Its own instance rather than a shelf inside
// `split-view` or `session`: a tip flag outlives both, and sharing a store
// would tie clearing one preference to clearing another.
// SOT: ./coach-mark.store.shared.ts · packages/ui/adaptive-panes/pane-overrides.store.native.ts
// SOT-KEYWORDS: coach mark native mmkv fork persistence seen once tip
//
// `createMMKV` factory, not `new MMKV()` — v4 made `MMKV` a type-only export.
import { createMMKV } from 'react-native-mmkv';
import { createCoachMarkStore } from './coach-mark.store.shared.ts';

const storage = createMMKV({ id: 'coach-marks' });

export const useCoachMarkStore = createCoachMarkStore({
  getString: (key) => storage.getString(key),
  set: (key, value) => storage.set(key, value),
  remove: (key) => storage.remove(key),
});
