// PLATFORM FORK — localStorage behind MMKV's shape, absent during SSR. A null
// on the server is correct: the dispatcher only runs client-side, and the ops
// prefs fork established that SSR sees defaults, not saved state.
// SOT: docs/pack/36-role-navigation-flows.md §2
// SOT-KEYWORDS: last used shell web localstorage fork

import { readLastShellRole, writeLastShellRole, type LastShellStorage } from './last-shell.shared.ts';
import type { RoleKind } from './types';

const storage: LastShellStorage = {
  getString: (key) => globalThis.localStorage?.getItem(key) ?? undefined,
  set: (key, value) => globalThis.localStorage?.setItem(key, value),
};

export function getLastShellRole(): RoleKind | null {
  if (typeof globalThis.localStorage === 'undefined') return null;
  return readLastShellRole(storage);
}

export function setLastShellRole(role: RoleKind): void {
  if (typeof globalThis.localStorage === 'undefined') return;
  writeLastShellRole(storage, role);
}
