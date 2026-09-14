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
//
// THE SECOND HALF OF THE QUESTION IS ANSWERED HERE TOO, AND STILL WITHOUT VIRO.
// `canOpenSpatialBoard` is the cheap check the 2D screen runs on every device.
// `spatialEligibility` is the full one, and it takes the runtime's own flags as
// ARGUMENTS rather than importing them — which is what keeps this file free of
// `@reactvision/react-viro` while still being the one place the rule is written
// down, and what makes the rule testable without a headset. Reading those flags
// is `xr-eligibility`'s job, because the store calls it before the first frame
// and the store is loaded on every device.
// SOT: packages/app/features/tutor/xr-eligibility.native.ts
//      packages/app/features/tutor/tutor-xr-entry.native.tsx
//      packages/app/features/tutor/tutor-xr-screen.native.tsx
// SOT-KEYWORDS: xr capability check platform native module headset availability fail closed eligibility permission primer

import { NativeModules, Platform } from 'react-native';
import type { XrUnsupportedReason } from './xr-session.store.ts';

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

/**
 * What the runtime knows about itself, as plain booleans.
 *
 * These are `hasOpenXRSupport` and `isQuest` from
 * `@reactvision/react-viro`'s `ViroPlatform` — constants, not functions, which
 * is worth saying because calling them reads fine and returns a truthy
 * function object on every device. Passed in rather than imported so this file
 * stays loadable from the 2D tutor screen.
 */
export interface XrRuntimeFacts {
  /** This BUILD registered the OpenXR VR native module. Says nothing about the device. */
  hasOpenXrModule: boolean;
  /** This DEVICE is a headset the spatial navigator is verified on. */
  isHeadset: boolean;
}

/** Eligible, or the reason it is not — the same reasons the screen renders. */
export type XrEligibility =
  | 'eligible'
  | Extract<XrUnsupportedReason, 'no-xr-runtime' | 'device-not-eligible'>;

/**
 * Whether this binary on this device can open the spatial board at all.
 *
 * THE THREE FACTS, IN THE ORDER A FAILURE MATTERS. The renderer has to be
 * linked, the OpenXR module has to be in this build, and the device has to be a
 * headset — and the first two are the same answer to a child ("this app was not
 * built for it"), which is why they share a reason.
 *
 * `isARSupportedOnDevice()` is deliberately NOT consulted, although the
 * installed fork exports it. It answers the ARCore/ARKit question, and this
 * screen renders through `ViroXRSceneNavigator` — the headset compositor path,
 * which does not go through ARCore at all. A phone that passes that check still
 * cannot open this board, and ADR-117 records handheld AR as out of scope; a
 * gate that said yes there would put a child in a scene with no way to draw.
 *
 * PICO reads as `device-not-eligible` today even though the fork supports it,
 * because `isPico` is not re-exported from the package root — only `isQuest` and
 * `hasOpenXRSupport` are. That is the fail-closed direction and it is a fact
 * about the package's entry point, not a decision about the hardware.
 */
export function spatialEligibility(runtime: XrRuntimeFacts): XrEligibility {
  if (!canOpenSpatialBoard()) return 'no-xr-runtime';
  if (!runtime.hasOpenXrModule) return 'no-xr-runtime';
  if (!runtime.isHeadset) return 'device-not-eligible';
  return 'eligible';
}

/**
 * What the spatial board asks the headset for, and nothing else.
 *
 * CAMERA ONLY. Passthrough is the whole reason — the board has to sit in the
 * child's room rather than in a void — and the runtime's other three
 * permissions have no part in it: the microphone belongs to the tutor's voice
 * and is asked for on the surface that uses it, and storage and location are
 * asked for by nothing here. A permission requested "while we are at it" is the
 * request a guardian reads as the app taking more than it said.
 *
 * Typed as its own literal rather than imported as `ViroPermission`, for this
 * file's no-Viro rule; `requestRequiredPermissions` accepts exactly these.
 */
export const SPATIAL_PERMISSIONS = ['camera'] as const;

/**
 * Whether every permission this board needs is already granted.
 *
 * FAIL CLOSED AGAIN: a key the runtime did not answer for reads as not granted,
 * so an unrecognised result shows the primer rather than mounting a scene that
 * would be black.
 */
export function spatialPermissionsGranted(
  /*
    Keyed by THIS feature's permissions rather than by `string`, which is what
    lets the runtime's own `ViroPermissionsResult` be passed straight in: that
    type is an interface of four optional booleans, and an interface is not
    assignable to an index signature. Narrowing the parameter instead of
    widening the argument keeps the call site free of a cast.
  */
  result: Partial<Record<(typeof SPATIAL_PERMISSIONS)[number], boolean>>,
): boolean {
  return SPATIAL_PERMISSIONS.every((permission) => result[permission] === true);
}
