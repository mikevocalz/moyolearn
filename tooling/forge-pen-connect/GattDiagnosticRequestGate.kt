package com.margelo.nitro.forgebluetooth.ble

/** Owner-thread ATT gate. A timeout/cancel cannot be correlated with a new request. */
internal class GattDiagnosticRequestGate<T : Any> {
  var active: T? = null
    private set
  var blocked = false
    private set
  fun start(request: T): Boolean {
    if (blocked || active != null) return false
    active = request
    return true
  }
  fun finish(request: T): Boolean {
    if (active !== request) return false
    active = null
    return true
  }
  fun startFailed(request: T, error: Throwable): Boolean {
    if (active !== request) return false
    // Android14 sets its private ATT busy flag before Binder permission checks,
    // but does not clear it when SecurityException escapes the public read API.
    if (error is SecurityException) blocked = true
    active = null
    return true
  }
  fun quarantine(request: T): Boolean {
    if (active !== request) return false
    blocked = true
    return true
  }
}
