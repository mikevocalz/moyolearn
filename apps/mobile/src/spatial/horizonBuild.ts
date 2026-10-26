// The quest-build fact every Meta layout gate reads.
// SOT: node_modules/expo-horizon-core/android/src/quest/java/expo/modules/horizon/Config.kt
// SOT-KEYWORDS: horizon quest build flavor gate expo-horizon-core
import { requireOptionalNativeModule } from 'expo';

type HorizonModule = { isHorizonBuild?: boolean };

/**
 * True only in the `quest` flavor, from expo-horizon-core's `ExpoHorizon`
 * module (its `Config.kt` is per flavor; `pico` falls back to `mobile`). A
 * build fact, not a device check: it decides whether Meta's spatial window
 * view manager was compiled in. android/app/build.gradle strips the Meta VR
 * Layout SDK from every other flavor, so rendering Meta's components there
 * would fail.
 *
 * Read through `requireOptionalNativeModule` because the package's default
 * export throws where the module is not linked (iOS, web, node:test).
 */
export const isHorizonBuild: boolean =
  requireOptionalNativeModule<HorizonModule>('ExpoHorizon')?.isHorizonBuild ?? false;
