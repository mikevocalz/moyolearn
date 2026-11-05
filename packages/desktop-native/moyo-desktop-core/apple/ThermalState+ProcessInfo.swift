//
// ThermalState+ProcessInfo.swift
// Maps Foundation's ProcessInfo.ThermalState onto the generated Nitro enum.
// SOT-KEYWORDS: desktop nitro thermal state conversion
//

import Foundation

extension ThermalState {
  init(_ state: ProcessInfo.ThermalState) {
    switch state {
    case .nominal: self = .nominal
    case .fair: self = .fair
    case .serious: self = .serious
    case .critical: self = .critical
    // A state added after macOS 27 is treated as serious: it throttles background
    // work in PR-D05 without the pause that critical triggers.
    @unknown default: self = .serious
    }
  }
}
