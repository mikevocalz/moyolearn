package com.margelo.nitro.forgebluetooth.ble

import org.junit.Assert.*
import org.junit.Test

class CompanionChooserCompletionTest {
  @Test fun callbackOnlyPublishesVerifiedSelectionWithoutInventingActivityResult() {
    val owner = CompanionChooserCompletion()
    var publications = 0
    assertEquals("real-selected-device", owner.complete("association-callback", null) { publications++; "real-selected-device" })
    assertTrue(owner.settled); assertEquals("association-callback", owner.source)
    assertNull(owner.resultCode); assertEquals(1, publications)
  }
  @Test fun duplicateCallbackAndLaterActivityResultCannotRepublishOrOverwriteSource() {
    val owner = CompanionChooserCompletion()
    var publications = 0
    owner.complete("association-callback", null) { publications++; "actual" }
    assertNull(owner.complete("association-callback", null) { publications++; "duplicate" })
    assertNull(owner.complete("activity-result", -1) { publications++; "late-result" })
    assertFalse(owner.cancel()); assertEquals(1, publications); assertNull(owner.resultCode)
    assertEquals("association-callback", owner.source)
  }
  @Test fun actualActivityResultCanWinAndCancellationSuppressesLateCallbacks() {
    val owner = CompanionChooserCompletion()
    assertEquals("actual", owner.complete("activity-result", -1) { "actual" })
    assertEquals(-1, owner.resultCode)
    val cancelled = CompanionChooserCompletion()
    assertTrue(cancelled.cancel())
    assertNull(cancelled.complete("association-callback", null) { error("Stale selection must not publish") })
    assertNull(cancelled.source)
  }
  @Test fun verificationFailureNeverClaimsSuccessfulCompletion() {
    val owner = CompanionChooserCompletion()
    try { owner.complete("association-callback", null) { throw IllegalStateException("Not an owned association") }; fail() }
    catch (_: IllegalStateException) {}
    assertFalse(owner.settled); assertNull(owner.source)
    assertTrue(owner.cancel())
  }
}
