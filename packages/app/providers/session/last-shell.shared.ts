// Last-used shell — the doc 36 §2 memory behind "n roles → last-used shell".
// A read/write pair over whatever synchronous key-value store the platform fork
// hands over (MMKV native, localStorage web) — the ops table prefs' exact
// arrangement, reused rather than re-invented. Synchronous is the requirement:
// the dispatcher runs on first render, and an async read would flash the wrong
// shell before correcting itself.
// SOT: docs/pack/36-role-navigation-flows.md §2
// SOT-KEYWORDS: last used shell role persistence dispatch boot mmkv

import type { RoleKind } from './types';

export const LAST_SHELL_KEY = 'last-shell-role';

/** The two operations this needs. MMKV and localStorage both have this shape. */
export interface LastShellStorage {
  getString: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
}

const ROLE_KINDS: readonly RoleKind[] = ['learner', 'guardian', 'tutor', 'teacher', 'owner'];

/** Never trusted as-is: the save may predate a role rename. */
export function readLastShellRole(storage: LastShellStorage): RoleKind | null {
  const raw = storage.getString(LAST_SHELL_KEY);
  return ROLE_KINDS.includes(raw as RoleKind) ? (raw as RoleKind) : null;
}

export function writeLastShellRole(storage: LastShellStorage, role: RoleKind): void {
  storage.set(LAST_SHELL_KEY, role);
}
