'use client';
// Every runtime permission, asked once as the app loads.
//
// Product call (2026-10-14): ask up front instead of at first use. On a
// headset the "first use" surfaces open inside the immersive scene, where an
// Android dialog renders in the 2D window behind it and the child never sees
// it — that is how the spatial board shipped dead after a fresh install.
//
// Only keys the OS can still show a dialog for are asked (`canAsk`), one at a
// time, so a relaunch after everything is answered raises nothing.
// SOT: packages/app/features/permissions/permission-request.native.ts
// SOT-KEYWORDS: permissions launch ask all up front startup quest headset camera anchor

import { useEffect } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { requestNativePermission } from './permission-request.native.ts';
import { usePermissions } from './permissions.store.ts';
import { PERMISSION_KEYS, canAsk } from './permissions.types.ts';

/*
  Quest-only runtime grants. Not checklist rows: no screen reads them yet
  beyond Viro's passthrough camera and room anchors, and PICO rejects both as
  unknown permissions (measured on a 4 Ultra, 2026-07-31).
*/
const QUEST_PERMISSIONS = ['horizonos.permission.HEADSET_CAMERA', 'horizonos.permission.USE_ANCHOR_API'];

function isQuest(): boolean {
  if (Platform.OS !== 'android') return false;
  const brand = String((Platform.constants as { Manufacturer?: string }).Manufacturer ?? '').toLowerCase();
  return brand === 'oculus' || brand === 'meta';
}

let asked = false;

export function useAskPermissionsOnLaunch(): void {
  useEffect(() => {
    // ponytail: once per process; a relaunch re-asks only what is still askable.
    if (asked) return;
    asked = true;
    void (async () => {
      const { statuses } = usePermissions.getState();
      for (const key of PERMISSION_KEYS) {
        if (canAsk(statuses[key])) await requestNativePermission(key);
      }
      if (isQuest()) {
        for (const permission of QUEST_PERMISSIONS) {
          try {
            await PermissionsAndroid.request(permission as Parameters<typeof PermissionsAndroid.request>[0]);
          } catch {
            /* An OS that does not know the key has nothing to ask. */
          }
        }
      }
    })();
  }, []);
}
