/**
 * moyo-desktop-core public entry. Barrel only: the Nitro adapter import, the
 * generated HybridObject class and its types.
 * Importing react-native-nitro-modules installs Nitro v1's proxy and dispatcher
 * through its TurboModule before the generated class looks itself up.
 * SOT-KEYWORDS: desktop nitro moyo-desktop-core entry barrel v1
 */
import 'react-native-nitro-modules'

export { MoyoDesktopCore } from './specs/MoyoDesktopCore.nitro'
export type { PlatformInfo } from './specs/PlatformInfo'
export type { ThermalState } from './specs/ThermalState'
export type { ThermalStateSubscription } from './specs/ThermalStateSubscription'
