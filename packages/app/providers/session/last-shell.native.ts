// PLATFORM FORK — MMKV, instance id `session`. Synchronous reads so the very
// first render of the dispatcher already knows which shell to open.
// SOT: docs/pack/36-role-navigation-flows.md §2
// SOT-KEYWORDS: last used shell native mmkv fork

import { createMMKV } from 'react-native-mmkv';
import { readLastShellRole, writeLastShellRole } from './last-shell.shared.ts';
import type { RoleKind } from './types';

const storage = createMMKV({ id: 'session' });

export function getLastShellRole(): RoleKind | null {
  return readLastShellRole(storage);
}

export function setLastShellRole(role: RoleKind): void {
  writeLastShellRole(storage, role);
}
