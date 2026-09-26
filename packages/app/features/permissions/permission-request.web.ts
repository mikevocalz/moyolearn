'use client';
// PLATFORM FORK — the browser has no permission checklist to run.
//
// It is not a lie by omission: a browser raises its own prompt at
// `getUserMedia` time and exposes no way to ask ahead, so every key answers
// `undetermined` — the state that means "this code obtained no grant" — and the
// checklist shows a browser what is true of a browser. `openSettings` has
// nowhere to go and does nothing rather than pretending.
// SOT: packages/app/features/permissions/permission-request.native.ts
// SOT-KEYWORDS: permission request web fork undetermined no runtime grant browser

import { useMemo } from 'react';
import { usePermissions } from './permissions.store.ts';
import type { PermissionKey, PermissionState } from './permissions.types.ts';
import type { PermissionRequester } from './permission-request.types.ts';

export function usePermissionRequester(): PermissionRequester {
  const setStatus = usePermissions((s) => s.setStatus);
  return useMemo(() => {
    const request = async (key: PermissionKey): Promise<PermissionState> => {
      setStatus(key, 'undetermined');
      return 'undetermined';
    };
    return {
      request,
      requestAll: async (keys: readonly PermissionKey[]) => {
        const out: Partial<Record<PermissionKey, PermissionState>> = {};
        for (const key of keys) out[key] = await request(key);
        return out as Record<PermissionKey, PermissionState>;
      },
      openSettings: () => {},
    };
  }, [setStatus]);
}
