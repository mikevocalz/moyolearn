package com.margelo.nitro.forgebluetooth.ble

/** ASA 1.1 negotiation; this host implements no optional accessory features. */
internal object SpatialAccessoryVersionPolicy {
  /** Validates an actual accessory-version value and builds its host-version reply. */
  fun createHostVersion(accessoryVersion: ByteArray): ByteArray {
    // Apple Accessory Design Guidelines R32 Update 1, tables 19-15 and 19-17.
    require(accessoryVersion.size in 4 until 512) { "Invalid ASA accessory-version size" }
    require((accessoryVersion[0].toInt() and 0xff) == 2) { "ASA version field must contain two bytes" }
    require((accessoryVersion[1].toInt() and 0xff) == 1 &&
      (accessoryVersion[2].toInt() and 0xff) == 1) { "Unsupported ASA protocol version" }
    val featureLength = accessoryVersion[3].toInt() and 0xff
    require(accessoryVersion.size == 4 + featureLength) { "Invalid ASA feature length" }
    // Do not copy device capabilities: neither TimeSync nor timeout changes are implemented.
    return ByteArray(3 + featureLength).also { hostVersion ->
      hostVersion[0] = 1
      hostVersion[1] = 1
      hostVersion[2] = featureLength.toByte()
    }
  }
}
