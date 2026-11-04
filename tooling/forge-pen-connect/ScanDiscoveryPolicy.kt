package com.margelo.nitro.forgebluetooth.ble

/** Scanner support is established by its actual callback, not advertiser capability. */
internal class ScanDiscoveryPolicy {
  var requestedLegacyOnly = false
    private set
  var fallbackUsed = false
    private set
  var fallbackError: Int? = null
    private set

  fun retryLegacyAfterFailure(errorCode: Int): Boolean {
    // ScanCallback.SCAN_FAILED_FEATURE_UNSUPPORTED; no retry for other failures.
    if (errorCode != 4 || fallbackUsed) return false
    requestedLegacyOnly = true
    fallbackUsed = true
    fallbackError = errorCode
    return true
  }
}
