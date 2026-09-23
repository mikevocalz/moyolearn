'use client';
// Actually asking the OS, and recording what it actually said.
//
// WHY THIS EXISTS. `RECORD_AUDIO` has been in the manifest since the app was
// scaffolded and nothing ever requested the runtime grant. A manifest entry
// grants nothing on Android 6 and later — it only makes the permission
// requestable — so the mic was declared, the recorder was installed, and every
// attempt to talk to the tutor failed at the OS with no dialog and no error a
// child could read. The one place that did ask (`VoiceRecorder`) asked inline,
// at the moment of recording, which is why nothing in the headset ever asked at
// all: the spatial route does not mount that component.
//
// SO THE ASK MOVES OUT OF THE COMPONENT. One requester, called by the checklist
// before a feature needs the grant and by the feature itself as a last line, so
// there is exactly one rule about when this app raises a system dialog.
//
// IT NEVER CLAIMS A GRANT IT DID NOT OBTAIN. iOS raises its own microphone
// prompt at first capture and exposes no API this side can call; recording that
// as `granted` would make the checklist lie to a guardian, so it stays
// `undetermined` and the OS asks when it needs to. Same reasoning as poke-xr's
// requester, which this is modelled on.
//
// Privacy posture: this module ASKS. It requests only the key it was handed,
// writes only a status to the persisted store, opens no capture session, reads
// no sensor, and never re-prompts on its own — a second dialog needs a second
// press.
// SOT: ~/poke-xr/packages/app/features/onboarding/permission-request.native.ts
// SOT-KEYWORDS: permission request native android runtime grant record audio camera photos settings blocked

import { useCallback, useMemo } from 'react';
import { Linking, PermissionsAndroid, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { usePermissions } from './permissions.store.ts';
import type { PermissionKey, PermissionState } from './permissions.types.ts';
import type { PermissionRequester } from './permission-request.types.ts';

/**
 * Ask Android for one manifest permission and read its three-way answer.
 *
 * NEVER_ASK_AGAIN is kept apart from a plain denial because the OS treats them
 * differently and the child does too: one more press will show a dialog, the
 * other will do nothing at all, and only the second has anywhere to send them.
 */
async function askAndroid(
  permission: Parameters<typeof PermissionsAndroid.request>[0],
): Promise<PermissionState> {
  const result = await PermissionsAndroid.request(permission);
  if (result === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
  if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'blocked';
  return 'denied';
}

async function requestOne(key: PermissionKey): Promise<PermissionState> {
  switch (key) {
    case 'microphone': {
      /*
        Straight at `PermissionsAndroid`, not through an expo module: nothing in
        this app's dependency set owns the mic permission, and
        `react-native-audio-api` deliberately does not request it — it records
        when asked and fails when it may not, which is the right split.

        On a PICO the app runs as a normal Android package, so this is the same
        system dialog a phone shows, rendered by the headset's 2D overlay.
      */
      if (Platform.OS !== 'android') return 'undetermined';
      return askAndroid(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    }
    case 'camera': {
      /*
        `expo-image-picker` rather than a camera library's own hook. The hooks
        in VisionCamera-style packages resolve a camera factory and initialise
        CameraX to answer a yes/no question; on a headset CameraX enumerates
        zero cameras and throws, turning a permission row into a red error box.
        The image-picker calls go to the OS permission APIs and touch no camera
        pipeline, so they behave the same on a phone and on a camera-gated
        headset — poke-xr's finding, and it applies here unchanged.
      */
      const res = await ImagePicker.requestCameraPermissionsAsync();
      if (res.granted) return 'granted';
      return res.canAskAgain === false ? 'blocked' : 'denied';
    }
    case 'photos': {
      /*
        Read access, not write-only: this app ATTACHES work a child already has
        rather than saving captures to the library.
      */
      const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (res.granted) return 'granted';
      return res.canAskAgain === false ? 'blocked' : 'denied';
    }
  }
}

export function usePermissionRequester(): PermissionRequester {
  const setStatus = usePermissions((s) => s.setStatus);

  const request = useCallback(
    async (key: PermissionKey): Promise<PermissionState> => {
      /*
        A throw here is a permission we could not read, which is NOT a refusal.
        Recording it as denied would send a guardian to a Settings page to fix
        something they never broke, so an unreadable answer stays undetermined
        and the next attempt asks again.
      */
      let state: PermissionState;
      try {
        state = await requestOne(key);
      } catch {
        state = 'undetermined';
      }
      setStatus(key, state);
      return state;
    },
    [setStatus],
  );

  const requestAll = useCallback(
    async (keys: readonly PermissionKey[]) => {
      const out: Partial<Record<PermissionKey, PermissionState>> = {};
      for (const key of keys) {
        out[key] = await request(key);
      }
      return out as Record<PermissionKey, PermissionState>;
    },
    [request],
  );

  return useMemo(
    () => ({ request, requestAll, openSettings: () => void Linking.openSettings() }),
    [request, requestAll],
  );
}
