/**
 * The splash's heart field, minus the field, on visionOS.
 *
 * `./hearts-gpu.tsx` imports `react-native-webgpu`, and that import is not
 * inert: the package's entry calls `TurboModuleRegistry.getEnforcing(
 * "WebGPUModule")` and then `WebGPUModule.install()` at module scope
 * (node_modules/react-native-webgpu/lib/module/main/index.js). visionOS does
 * not autolink the package — Dawn's published `libwebgpu_dawn.xcframework` has
 * macos/ios/ios-simulator slices and no xros one, so linking it fails with
 * `ld: library 'webgpu_dawn' not found` (apps/mobile/react-native.config.js).
 * With no native module behind it, `getEnforcing` throws, and `MoyoSplash`
 * imports this file statically from the root layout — so the app would die on
 * the first screen a child ever sees.
 *
 * `MoyoSplash` already treats the field as optional ("it renders nothing at all
 * if WebGPU is unavailable, so the splash never depends on it"), so the splash
 * plays its full timeline here with the lockup, the cascade and the tagline —
 * only the particles are absent. `levelsRef` is still written every 50 ms by
 * the splash's own clock; nothing reads it on this platform.
 *
 * iOS and Android keep the real field: they resolve `./hearts-gpu` to the
 * WebGPU implementation, and this file is invisible to them.
 *
 * SOT: ./hearts-gpu.tsx · ./MoyoSplash.tsx · apps/mobile/react-native.config.js
 * SOT-KEYWORDS: splash hearts webgpu visionos xros dawn autolinking stub
 */

export interface HeartFieldLevels {
  /** The heart field's level, 0 → 1. Written by the splash, unread here. */
  hearts: number;
  /** The spark burst's level, rising and falling with the ornament cascade. */
  sparks: number;
}

export interface HeartFieldProps {
  levelsRef: { current: HeartFieldLevels };
}

export function HeartField(_props: HeartFieldProps) {
  return null;
}
