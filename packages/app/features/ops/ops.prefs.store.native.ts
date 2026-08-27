'use client';
// PLATFORM FORK — MMKV, instance id `ops`. Its reads are synchronous, so the
// very first render already knows the density and the hidden columns.
// SOT-KEYWORDS: ops prefs store native mmkv durable density columns
import { useStore } from 'zustand';
import { createMMKV } from 'react-native-mmkv';
import {
  createOpsPrefsStore,
  readTablePrefs,
  type OpsPrefsState,
} from './ops.prefs.store.shared.ts';

const storage = createMMKV({ id: 'ops' });
const store = createOpsPrefsStore(storage, readTablePrefs(storage));

export function useOpsTablePrefs<T>(selector: (state: OpsPrefsState) => T): T {
  return useStore(store, selector);
}
