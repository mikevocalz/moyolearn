// The requester's contract, in a file no platform module is named from.
// SOT: packages/app/features/permissions/permission-request.native.ts
// SOT-KEYWORDS: permission requester contract types platform neutral

import type { PermissionKey, PermissionState } from './permissions.types.ts';

export interface PermissionRequester {
  /** Ask the OS for one permission and record the real answer. */
  request: (key: PermissionKey) => Promise<PermissionState>;
  /**
   * Ask for several, in order, stopping at nothing.
   *
   * Sequential rather than parallel: Android queues permission dialogs and
   * shows them one at a time anyway, and firing them together on some OEM
   * builds drops all but the first.
   */
  requestAll: (keys: readonly PermissionKey[]) => Promise<Record<PermissionKey, PermissionState>>;
  /** Open this app's OS settings page — the only route after a blocked denial. */
  openSettings: () => void;
}
