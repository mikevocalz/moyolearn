// The two Round 2 switches of the 2026-10 device pass, off unless a validation
// run asks for them.
//
//   nativeBoard  draw the tutor board's paper with `QuickDrawNativeBoard`
//                (viro-external native-panels) instead of the WebView board
//   nativeRive   draw the board's Rive chrome with `ViroNativeRivePanel`
//                (ViroCore's VRORivePanel) instead of `ViroRivePanel`
//
// TWO WAYS IN, BOTH OUTSIDE THE LEARNER UI. A build can bake a default with
// EXPO_PUBLIC_MOYO_NATIVE_BOARD=1 / EXPO_PUBLIC_MOYO_NATIVE_RIVE=1 (Metro
// inlines them at bundle time), and the engineering route
// `moyo://device-validation-probe?nativeBoard=1&nativeRive=1` sets them for
// the running process. No screen a child can reach shows or changes them.
//
// A REQUEST IS NOT A GUARANTEE. Each consumer also checks that the native
// classes are linked into this build (`native-panels-linked.native.ts`)
// and keeps today's path when they are not.
// SOT: apps/mobile/app/device-validation-probe.tsx · tutor-xr-screen.native.tsx
// SOT-KEYWORDS: device validation flags native board native rive round 2 zustand

import { createStore } from 'zustand/vanilla';

/** The requested state of the Round 2 switches. */
export interface DeviceValidationFlags {
  nativeBoard: boolean;
  nativeRive: boolean;
}

function envFlag(value: string | undefined): boolean {
  return value === '1' || value === 'true';
}

/** The defaults a bundle starts with, read from the two build-time variables. */
export function initialDeviceValidationFlags(env: {
  EXPO_PUBLIC_MOYO_NATIVE_BOARD?: string;
  EXPO_PUBLIC_MOYO_NATIVE_RIVE?: string;
}): DeviceValidationFlags {
  return {
    nativeBoard: envFlag(env.EXPO_PUBLIC_MOYO_NATIVE_BOARD),
    nativeRive: envFlag(env.EXPO_PUBLIC_MOYO_NATIVE_RIVE),
  };
}

/**
 * The process-wide switches. The variables are read by name so Metro can
 * inline them; `process.env` as a whole is not available in a bundle.
 */
export const deviceValidationFlags = createStore<DeviceValidationFlags>(() =>
  initialDeviceValidationFlags({
    EXPO_PUBLIC_MOYO_NATIVE_BOARD: process.env.EXPO_PUBLIC_MOYO_NATIVE_BOARD,
    EXPO_PUBLIC_MOYO_NATIVE_RIVE: process.env.EXPO_PUBLIC_MOYO_NATIVE_RIVE,
  }),
);
