// Onboarding draft persistence — the shared half of the platform fork.
// A guardian interrupted mid-flow (doc 37 §2, pane-audit-37 §A.3 risk line)
// must reopen onto the children and consent they already entered, so the flow
// stores persist through whatever synchronous key-value store the platform
// fork hands over (MMKV native, localStorage web) — the last-shell
// arrangement, reused rather than re-invented. Synchronous is the requirement
// here too: zustand's `persist` hydrates during `create()` when the storage
// answers synchronously, so the first render of a resumed flow is already on
// the right step instead of flashing `welcome` and correcting itself.
// SOT: docs/pack/37-onboarding-dual-pane.md §2 · providers/session/last-shell.shared.ts
// SOT-KEYWORDS: onboarding persistence storage fork zustand persist mmkv localstorage

import type { StateStorage } from 'zustand/middleware';

/** The three operations `persist` needs. MMKV and localStorage both fit. */
export interface OnboardingKeyValueStore {
  getString: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
  remove: (key: string) => void;
}

/** Adapts a synchronous key-value store to zustand's `StateStorage`. */
export function stateStorageOver(store: OnboardingKeyValueStore): StateStorage {
  return {
    getItem: (key) => store.getString(key) ?? null,
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.remove(key),
  };
}
