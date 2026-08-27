'use client';
// PLATFORM FORK — localStorage behind MMKV's shape, absent during SSR.
// Same hydration discipline as the editor toolbar's fork: the store opens on
// the DEFAULTS even in the browser and adopts the saved value one effect later,
// because the server rendered default columns into the HTML and a first client
// render that disagrees is a hydration mismatch, not a preference.
// SOT-KEYWORDS: ops prefs store web localstorage hydrate durable density columns
import { useEffect } from 'react';
import { useStore } from 'zustand';
import { DEFAULT_TABLE_PREFS } from './ops.prefs.ts';
import {
  createOpsPrefsStore,
  readTablePrefs,
  type OpsPrefsState,
  type OpsPrefsStorage,
} from './ops.prefs.store.shared.ts';

const storage: OpsPrefsStorage = {
  getString: (key) => globalThis.localStorage?.getItem(key) ?? undefined,
  set: (key, value) => globalThis.localStorage?.setItem(key, value),
  remove: (key) => globalThis.localStorage?.removeItem(key),
};

const store = createOpsPrefsStore(storage, DEFAULT_TABLE_PREFS);
let adopted = false;

function adoptSaved() {
  if (adopted) return;
  adopted = true;
  const saved = readTablePrefs(storage);
  if (saved !== DEFAULT_TABLE_PREFS) store.setState({ prefs: saved });
}

export function useOpsTablePrefs<T>(selector: (state: OpsPrefsState) => T): T {
  useEffect(adoptSaved, []);
  return useStore(store, selector);
}
