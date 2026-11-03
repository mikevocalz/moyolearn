package com.margelo.nitro.forgebluetooth.ble

import org.junit.Assert.*
import org.junit.Test

class ScanDiscoveryPolicyTest {
  @Test fun initiallyRequestsExtendedResultsWithoutAdvertiserCapabilityGate() {
    val policy = ScanDiscoveryPolicy()
    assertFalse(policy.requestedLegacyOnly)
    assertFalse(policy.fallbackUsed)
    assertNull(policy.fallbackError)
  }
  @Test fun retriesLegacyOnlyOnceAfterActualUnsupportedFeatureCallback() {
    val policy = ScanDiscoveryPolicy()
    assertTrue(policy.retryLegacyAfterFailure(4))
    assertTrue(policy.requestedLegacyOnly); assertTrue(policy.fallbackUsed)
    assertEquals(4, policy.fallbackError)
    assertFalse(policy.retryLegacyAfterFailure(4))
  }
  @Test fun preservesRealOtherFailuresWithoutRetry() {
    for (error in listOf(1, 2, 3, 5, 6)) {
      val policy = ScanDiscoveryPolicy()
      assertFalse(policy.retryLegacyAfterFailure(error))
      assertFalse(policy.requestedLegacyOnly); assertFalse(policy.fallbackUsed)
      assertNull(policy.fallbackError)
    }
  }
  @Test fun newScanHasIndependentRetryBudget() {
    val old = ScanDiscoveryPolicy(); old.retryLegacyAfterFailure(4)
    val next = ScanDiscoveryPolicy()
    assertFalse(next.requestedLegacyOnly); assertTrue(next.retryLegacyAfterFailure(4))
  }
}
