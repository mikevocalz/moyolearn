package com.margelo.nitro.forgebluetooth.ble

import org.junit.Assert.*
import org.junit.Test

class SpatialAccessoryVersionPolicyTest {
  @Test fun selectsOnlyImplementedFeaturesAndPreservesInput() {
    val actualRead = byteArrayOf(2, 1, 1, 1, 3)
    assertArrayEquals(byteArrayOf(1, 1, 1, 0), SpatialAccessoryVersionPolicy.createHostVersion(actualRead))
    assertArrayEquals(byteArrayOf(2, 1, 1, 1, 3), actualRead)
  }

  @Test fun acceptsEmptyFeatureSet() {
    assertArrayEquals(byteArrayOf(1, 1, 0),
      SpatialAccessoryVersionPolicy.createHostVersion(byteArrayOf(2, 1, 1, 0)))
  }

  @Test fun clearsEveryFeatureByteIncludingUnsignedLengths() {
    val actualRead = ByteArray(259) { 0xff.toByte() }
    actualRead[0] = 2; actualRead[1] = 1; actualRead[2] = 1
    val hostVersion = SpatialAccessoryVersionPolicy.createHostVersion(actualRead)
    assertEquals(258, hostVersion.size)
    assertEquals(255, hostVersion[2].toInt() and 0xff)
    assertTrue(hostVersion.drop(3).all { it == 0.toByte() })
  }

  @Test fun rejectsMalformedLengthsTruncationAndTrailingData() {
    listOf(byteArrayOf(), byteArrayOf(2, 1, 1), byteArrayOf(1, 1, 1, 0),
      byteArrayOf(3, 1, 1, 0), byteArrayOf(2, 1, 1, 1),
      byteArrayOf(2, 1, 1, 0, 0), byteArrayOf(2, 1, 1, 2, 0),
      ByteArray(512)).forEach { malformed ->
      assertThrows(IllegalArgumentException::class.java) {
        SpatialAccessoryVersionPolicy.createHostVersion(malformed)
      }
    }
  }

  @Test fun rejectsUnknownMajorOrMinorInsteadOfGuessingCompatibility() {
    listOf(byteArrayOf(2, 0, 0, 0), byteArrayOf(2, 1, 0, 0),
      byteArrayOf(2, 1, 2, 0), byteArrayOf(2, 2, 1, 0),
      byteArrayOf(2, 0xff.toByte(), 1, 0)).forEach { unsupported ->
      assertThrows(IllegalArgumentException::class.java) {
        SpatialAccessoryVersionPolicy.createHostVersion(unsupported)
      }
    }
  }
}
