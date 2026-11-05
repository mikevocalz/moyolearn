/**
 * `@acme/motion/native`: Kinetrell's Reanimated runtime with Moyo's policy
 * applied. Import only from React Native code (apps/mobile, `*.native.tsx`);
 * it pulls in react-native-reanimated, react-native-worklets and, for the
 * gesture hook, react-native-gesture-handler.
 *
 * What the wrappers change, and nothing else:
 *  - `useMotion` resolves the reduced-motion request through
 *    `resolveReducedMotionPolicy` and always finishes under reduced motion.
 *  - `useParallax` returns a still value under reduced motion; motion.md §1
 *    says parallax stops completely, and Kinetrell's hook has no policy input.
 *  - `useMotionPanGesture` settles with the `feedback` preset unless told
 *    otherwise, so a settle is never an inline number.
 * The scroll hooks are re-exported untouched: they read the native scroll
 * position, which stays authoritative (no touch delay; Kinetrell
 * docs/accessibility.md).
 *
 * SOT: kinetrell src/native/runtime.ts (useMotion, useMotionStyle),
 *      src/native/scroll.ts (useKinetrellScroll, useSectionProgress, useParallax,
 *      useNativeScrollController, useNativeSnapController, useScrollScrub),
 *      src/native/scene.ts (useScrollScene), src/native/components.tsx (Motion),
 *      src/native/gesture.ts (useMotionPanGesture),
 *      src/native/gradient.ts (gradientToBackgroundImage)
 * SOT-KEYWORDS: motion native reanimated wrapper useMotion reduced-motion
 *               parallax gesture scroll kinetrell
 */
import { useDerivedValue, useReducedMotion, type SharedValue } from 'react-native-reanimated';
import {
  useMotion as useKinetrellMotion,
  useParallax as useKinetrellParallax,
  type NativeMotionHandle,
  type NativeMotionOptions,
} from 'kinetrell/native';
import {
  useMotionPanGesture as useKinetrellPanGesture,
  type MotionPanGestureOptions,
} from 'kinetrell/native/gesture';
import type { MotionDefinition } from 'kinetrell/core';
import { REDUCED_MOTION_BEHAVIOR, resolveReducedMotionPolicy } from './policy.ts';
import { presets } from './presets.ts';

export {
  Motion,
  gradientToBackgroundImage,
  useKinetrellScroll,
  useMotionStyle,
  useNativeScrollController,
  useNativeSnapController,
  useScrollScene,
  useScrollScrub,
  useSectionProgress,
  type KinetrellScrollSource,
  type KinetrellScrollState,
  type NativeMotionHandle,
  type NativeScrollController,
  type NativeSnapController,
  type ScrollSceneHandle,
  type ScrollSceneOptions,
} from 'kinetrell/native';

export type MotionOptions = Omit<NativeMotionOptions, 'reducedMotionBehavior'>;

export function useMotion(
  definition: MotionDefinition,
  options: MotionOptions = {},
): NativeMotionHandle {
  return useKinetrellMotion(definition, {
    ...options,
    reducedMotion: resolveReducedMotionPolicy(options.reducedMotion),
    reducedMotionBehavior: REDUCED_MOTION_BEHAVIOR,
  });
}

/** True when this device asked for reduced motion, after Moyo's policy. */
export function useMotionReduced(requested?: MotionOptions['reducedMotion']): boolean {
  const system = useReducedMotion();
  const policy = resolveReducedMotionPolicy(requested);
  if (policy === 'always') return true;
  if (policy === 'never') return false;
  return system;
}

export function useParallax(
  progress: SharedValue<number>,
  distance: number,
  center?: number,
): SharedValue<number> {
  const reduced = useMotionReduced();
  const moving = useKinetrellParallax(progress, reduced ? 0 : distance, center);
  return useDerivedValue(() => (reduced ? 0 : moving.value));
}

export function useMotionPanGesture(
  motion: NativeMotionHandle,
  options: MotionPanGestureOptions = {},
) {
  return useKinetrellPanGesture(motion, {
    ...options,
    settleDurationMs: options.settleDurationMs ?? presets.feedback.durationMs,
  });
}
