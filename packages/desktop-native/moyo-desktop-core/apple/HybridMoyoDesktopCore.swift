//
// HybridMoyoDesktopCore.swift
// Swift implementation of the MoyoDesktopCore Nitro spec (src/specs/MoyoDesktopCore.nitro.ts).
//
// Threading: getPlatformInfo runs on the caller's (JS) thread because every read
// is a cached ProcessInfo property. hashFile crosses once onto a utility queue
// through Promise.parallel. Thermal events arrive on ThermalStateObserver's
// serial queue; calling a Nitro v1 `Callback` from there schedules the JS call
// on the JS thread (callAndForget for Void).
// SOT-KEYWORDS: desktop nitro swift hybridobject moyo-desktop-core v1
//

import Foundation
import NitroModules

final class HybridMoyoDesktopCore: HybridMoyoDesktopCoreSpec {
  private let hashQueue = DispatchQueue(label: "com.moyolearn.desktop.core.hash", qos: .utility)
  private let thermal = ThermalStateObserver()

  func getPlatformInfo() throws -> PlatformInfo {
    return PlatformInfo.current()
  }

  func hashFile(path: String) throws -> any Promise<String> {
    let url = try URL.regularFile(path: path)
    return .parallel(hashQueue) { try url.sha256Hex() }
  }

  func addThermalStateListener(listener: any Callback<ThermalState, Void>) throws -> ThermalStateSubscription {
    let id = thermal.add(listener)
    return ThermalStateSubscription(remove: .native { [thermal] in thermal.remove(id) })
  }
}
