'use client';
// PLATFORM FORK — MMKV, instance id `split-view`, key `pane-overrides`, as a
// JSON blob of the size-class-keyed map. MMKV rather than a React state hook
// because the layout a user chose has to survive a process death, and MMKV's
// reads are synchronous — the first render already knows the answer.
// SOT: ./pane-overrides.store.shared.ts · ./README.md
// SOT-KEYWORDS: pane overrides native mmkv fork persistence
//
// v4 replaced the `new MMKV()` constructor with this factory; `MMKV` is a
// type-only export now.
import { createMMKV } from 'react-native-mmkv';
import { createPaneOverrideStore } from './pane-overrides.store.shared.ts';

const storage = createMMKV({ id: 'split-view' });

export const usePaneOverrideStore = createPaneOverrideStore({
  getString: (key) => storage.getString(key),
  set: (key, value) => storage.set(key, value),
  remove: (key) => storage.remove(key),
});
