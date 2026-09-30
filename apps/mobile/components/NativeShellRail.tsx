import type { NativeShellRailProps } from './NativeShellRail.types';

/**
 * TypeScript resolution / non-Android fallback. Metro selects the .android
 * implementation for Android. Apple keeps its existing shell/native semantics.
 */
export function NativeShellRail(_props: NativeShellRailProps) {
  return null;
}
