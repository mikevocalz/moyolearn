/**
 * MoyoDesktopCore: the first Nitro HybridObject in Moyo Learn for macOS.
 *
 * It proves the three call shapes later desktop modules need, inside Spark's
 * Hermes runtime on Nitro v1 (1.0.0-alpha.nightly.100, the version mobile pins):
 * a synchronous call (`getPlatformInfo`), an asynchronous call resolved off the
 * JS thread (`hashFile`), and a native callback (`addThermalStateListener`).
 * Swift-only: Spark builds macOS, which Nitro v1 generates under `@Apple`.
 * The public constructor makes JS write `new MoyoDesktopCore()`; v1 has no
 * `NitroModules.createHybridObject`.
 * SOT: packages/desktop-native/README.md · docs/desktop/seams/D03.md
 * SOT-KEYWORDS: desktop nitro hybridobject spec moyo-desktop-core swift v1
 */
import { Apple, type HybridObject } from 'nitro-core'
import type { PlatformInfo } from './PlatformInfo'
import type { ThermalState } from './ThermalState'
import type { ThermalStateSubscription } from './ThermalStateSubscription'

export * from '#nitro/MoyoDesktopCore'

@Apple({ language: 'swift', implementation: { className: 'HybridMoyoDesktopCore' } })
export declare class MoyoDesktopCore extends HybridObject {
  constructor()
  /** Cheap ProcessInfo reads; safe to call on the JS thread. */
  getPlatformInfo(): PlatformInfo
  /** SHA-256 of a local regular file as lowercase hex. Reads on a native queue; rejects for devices, FIFOs, directories and unreadable files. */
  hashFile(path: string): Promise<string>
  /** Called once with the current state, then on every ProcessInfo thermal-state change. After `remove()`, an event already in flight may still arrive once. */
  addThermalStateListener(listener: (state: ThermalState) => void): ThermalStateSubscription
}
