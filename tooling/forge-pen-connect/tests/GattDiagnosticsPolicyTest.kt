package com.margelo.nitro.forgebluetooth.ble

import org.junit.Assert.*
import org.junit.Test
import java.util.concurrent.atomic.AtomicLong

class GattDiagnosticsPolicyTest {
  @Test fun staleCompletionCannotReleaseCurrentRequest() {
    val gate = GattDiagnosticRequestGate<Any>(); val first = Any(); val second = Any()
    assertTrue(gate.start(first)); assertFalse(gate.start(second))
    assertTrue(gate.finish(first)); assertTrue(gate.start(second))
    assertFalse(gate.finish(first)); assertSame(second, gate.active)
  }
  @Test fun timeoutRequiresANewConnectionGateEvenAfterLateCompletion() {
    val gate = GattDiagnosticRequestGate<Any>(); val request = Any()
    assertTrue(gate.start(request)); assertTrue(gate.quarantine(request))
    assertTrue(gate.finish(request)); assertFalse(gate.start(Any()))
    assertTrue(GattDiagnosticRequestGate<Any>().start(Any()))
  }
  @Test fun securityExceptionRequiresReconnectAndCannotReleaseANewerRequest() {
    val gate = GattDiagnosticRequestGate<Any>(); val denied = Any()
    assertTrue(gate.start(denied))
    assertTrue(gate.startFailed(denied, SecurityException("Android restricted HID handle")))
    assertNull(gate.active); assertTrue(gate.blocked)
    assertFalse(gate.finish(denied)); assertFalse(gate.start(Any()))
    assertTrue(GattDiagnosticRequestGate<Any>().start(Any()))
  }
  @Test fun ordinaryStartFailureDoesNotInventARestrictedOrPoisonedConnection() {
    val gate = GattDiagnosticRequestGate<Any>(); val stale = Any(); val current = Any()
    assertTrue(gate.start(current))
    assertFalse(gate.startFailed(stale, SecurityException("stale callback")))
    assertFalse(gate.blocked); assertSame(current, gate.active)
    assertTrue(gate.startFailed(current, IllegalStateException("ordinary failure")))
    assertFalse(gate.blocked); assertTrue(gate.start(Any()))
  }
  @Test fun rawRingIsBoundedAndTruncationPreservesMeasuredLength() {
    val sequence = AtomicLong(); val ring = GattDiagnosticEventBuffer(7, sequence)
    repeat(130) { ring.append("notification", "real-key", null, ByteArray(600) { 0xff.toByte() }, 600, null, 100, 50) }
    val events = ring.snapshot(); assertEquals(128, events.length())
    assertEquals(3L, events.getJSONObject(0).getLong("sequence"))
    val last = events.getJSONObject(127)
    assertEquals(130L, last.getLong("sequence")); assertEquals(600, last.getInt("byteLength"))
    assertTrue(last.getBoolean("truncated")); assertEquals(1024, last.getString("hex").length)
    assertEquals(100L, last.getLong("wallTimeMs")); assertEquals(50L, last.getLong("elapsedRealtimeMs"))
    val next = GattDiagnosticEventBuffer(8, sequence); next.append("services", null, 0, null, 0, null, 101, 51)
    assertEquals(131L, next.snapshot().getJSONObject(0).getLong("sequence"))
  }
}
