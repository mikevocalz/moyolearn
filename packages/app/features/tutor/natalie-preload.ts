// Natalie's preload — "she is already standing there when the screen opens"
// (ADR-114). Called from the learner shell the moment it mounts, which is the
// earliest legitimate moment after the front door: the tutor screen is at
// most one tap away from anywhere in the shell, and the body's parse is the
// one cost that needs no canvas.
//
// Behind the same flag and the same `lazy` boundary as the stage: importing
// the renderer module installs `react-native-webgpu`'s JSI bindings, so a
// learner on the 2D path — or a binary that predates the native module —
// must never reach it. The dynamic import is the whole guard.
// SOT: ./tutor-avatar-3d.native.tsx (`preloadNatalie`) · docs/decisions/adr-114-preload-and-loader.md
// SOT-KEYWORDS: natalie preload learner shell warm start frame one flag lazy import parse ahead
import { Platform } from 'react-native';

/** The one switch, mirrored from `tutor-avatar.tsx` so the two cannot disagree. */
export const NATIVE_3D_ENABLED =
  Platform.OS !== 'web' && process.env.EXPO_PUBLIC_NATIVE_3D === '1';

/**
 * Starts the body's fetch, parse and texture decode ahead of the tutor screen.
 * Idempotent; the stage awaits the same promise. Never rejects to the caller —
 * a shell must not learn that a renderer had a bad day, and the stage's own
 * attempt is the real retry.
 */
export function preloadNatalie(): void {
  if (!NATIVE_3D_ENABLED) return;
  void import('./tutor-avatar-3d')
    .then((module) => module.preloadNatalie())
    .catch(() => undefined);
}
