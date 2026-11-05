//
// ThermalStateObserver.swift
// Owns the ProcessInfo thermal-state notification and the JS listeners.
//
// One serial queue owns `listeners` and `token`; add, remove and dispatch all
// run on it, so no lock is needed. That confinement is why the class is
// `@unchecked Sendable`: Swift 6 cannot see it. Calling a listener only
// enqueues work on the JS thread (a Void Nitro v1 `Callback` runs
// callAndForget), so dispatch can run on the queue without re-entrancy. A new
// listener receives the current state at once, closing the gap between the
// caller's getPlatformInfo() read and the subscription. `remove` is
// asynchronous: an event already queued may still be delivered once. The
// notification observer exists only while listeners do.
// SOT-KEYWORDS: desktop nitro thermal observer processinfo listener queue
//

import Foundation
import NitroModules

final class ThermalStateObserver: @unchecked Sendable {
  private let queue = DispatchQueue(label: "com.moyolearn.desktop.core.thermal")
  private var listeners: [UUID: any Callback<ThermalState, Void>] = [:]
  private var token: NSObjectProtocol?

  deinit {
    if let token { NotificationCenter.default.removeObserver(token) }
  }

  func add(_ listener: any Callback<ThermalState, Void>) -> UUID {
    let id = UUID()
    queue.async {
      self.listeners[id] = listener
      self.startIfNeeded()
      listener.callAndForget(ThermalState(ProcessInfo.processInfo.thermalState))
    }
    return id
  }

  func remove(_ id: UUID) {
    queue.async {
      self.listeners[id] = nil
      self.stopIfIdle()
    }
  }

  private func startIfNeeded() {
    guard token == nil else { return }
    token = NotificationCenter.default.addObserver(
      forName: ProcessInfo.thermalStateDidChangeNotification,
      object: nil,
      queue: nil
    ) { [weak self] _ in
      // Swift 6 rejects capturing the weak `self` var in the queued closure;
      // the strong copy lives only until that block has run.
      guard let self else { return }
      self.queue.async { self.emit() }
    }
  }

  private func stopIfIdle() {
    guard listeners.isEmpty, let token else { return }
    NotificationCenter.default.removeObserver(token)
    self.token = nil
  }

  private func emit() {
    let state = ThermalState(ProcessInfo.processInfo.thermalState)
    for listener in listeners.values { listener.callAndForget(state) }
  }
}
