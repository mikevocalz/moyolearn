// Whether this device can open a board in space, answered without loading a
// renderer.
//
// The check has to run on the 2D tutor screen, which is every learner's screen
// on every device — so it must not be the thing that pulls
// `@reactvision/react-viro` into a phone's bundle. Platform and the presence of
// the native module are enough to decide, and both are free.
//
// FAIL CLOSED. An unknown answer is "no": a button that opens a black scene on
// a device with no XR runtime is worse than a button that was never there, and
// a child cannot act on either.
// SOT: packages/app/features/tutor/tutor-xr-entry.native.tsx
// SOT-KEYWORDS: xr capability check platform native module headset availability fail closed

import { NativeModules, Platform } from 'react-native';

/**
 * True only on a native build that actually links ViroCore.
 *
 * `VRTSceneNavigatorModule` is the native module ViroReact registers for its
 * scene navigators; its absence means the app was built without the renderer,
 * which is the state of every Expo Go session and every build made before this
 * feature's prebuild. Checking the module rather than a version string is what
 * makes the answer true about THIS binary rather than about the JS in it.
 */
export function canOpenSpatialBoard(): boolean {
  if (Platform.OS === 'web') return false;
  const modules = NativeModules as Record<string, unknown>;
  return (
    typeof modules.VRTSceneNavigatorModule === 'object' && modules.VRTSceneNavigatorModule !== null
  );
}
