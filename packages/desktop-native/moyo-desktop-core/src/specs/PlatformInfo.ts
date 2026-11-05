/**
 * Cached host facts returned synchronously by `MoyoDesktopCore.getPlatformInfo()`.
 * Every field is a cheap ProcessInfo read, so the call stays synchronous.
 * SOT-KEYWORDS: desktop nitro platform info processinfo struct
 */
import type { ThermalState } from './ThermalState'

export interface PlatformInfo {
  /** `ProcessInfo.operatingSystemVersionString`, e.g. "Version 27.0 (Build 26A425)". */
  osVersion: string
  /** `ProcessInfo.activeProcessorCount`. */
  activeProcessorCount: number
  /** `ProcessInfo.physicalMemory` in bytes. */
  physicalMemoryBytes: number
  thermalState: ThermalState
}
