//
// PlatformInfo+current.swift
// Builds the generated PlatformInfo struct from ProcessInfo's cached values.
// SOT-KEYWORDS: desktop nitro platform info processinfo
//

import Foundation

extension PlatformInfo {
  static func current() -> PlatformInfo {
    let info = ProcessInfo.processInfo
    return PlatformInfo(
      osVersion: info.operatingSystemVersionString,
      activeProcessorCount: Double(info.activeProcessorCount),
      physicalMemoryBytes: Double(info.physicalMemory),
      thermalState: ThermalState(info.thermalState)
    )
  }
}
