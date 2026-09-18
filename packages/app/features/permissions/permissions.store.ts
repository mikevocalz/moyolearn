'use client';
// What the OS last told us about each permission, kept across launches.
//
// PERSISTED BECAUSE THE ALTERNATIVE IS ASKING AGAIN. A cold start with no
// record cannot tell "never asked" from "asked and refused", so a checklist
// built on live state alone re-offers a button the OS will silently ignore, and
// the child presses it and nothing happens. The store is the memory that lets
// a blocked row offer Settings instead.
//
// IT IS A CACHE, NOT THE TRUTH. A guardian can revoke a permission from the OS
// settings while the app is backgrounded and nothing tells us. So the value
// here is only ever used to render a checklist and to decide whether to ASK —
// never to decide whether a capture may proceed. That decision belongs to the
// call that captures, which gets a real answer or an error.
//
// No sensor data, no recordings, no transcripts: four string states, keyed by
// permission name. Same storage fork as the onboarding flow.
// SOT: packages/app/features/permissions/permissions.types.ts
// SOT-KEYWORDS: permissions store zustand persist mmkv status granted denied blocked undetermined

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { permissionsStateStorage } from './permissions-storage';
import { PERMISSION_KEYS, type PermissionKey, type PermissionState } from './permissions.types.ts';

interface PermissionsStore {
  statuses: Record<PermissionKey, PermissionState>;
  setStatus(key: PermissionKey, state: PermissionState): void;
}

const UNASKED = Object.fromEntries(
  PERMISSION_KEYS.map((key) => [key, 'undetermined' as PermissionState]),
) as Record<PermissionKey, PermissionState>;

export const usePermissions = create<PermissionsStore>()(
  persist(
    (set) => ({
      statuses: UNASKED,
      setStatus: (key, state) =>
        set((prev) => ({ statuses: { ...prev.statuses, [key]: state } })),
    }),
    {
      name: 'permissions',
      storage: createJSONStorage(() => permissionsStateStorage),
      /*
        A key added in a later release is absent from a saved blob, and a
        missing status must read as "never asked" rather than `undefined` —
        which `canAsk` would treat as a state it has no case for.
      */
      merge: (saved, current) => {
        const persisted = (saved as Partial<PermissionsStore> | undefined)?.statuses;
        return { ...current, statuses: { ...UNASKED, ...persisted } };
      },
    },
  ),
);
