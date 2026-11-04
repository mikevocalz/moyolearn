package com.margelo.nitro.forgebluetooth.ble

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class ScanAdvertisementMetadataTest {
  @Test fun preservesMeasuredFieldsWithoutInventingIdentityOrRssi() {
    val item = ScanAdvertisementMetadata(listOf("actual-service"), mapOf("actual-service" to byteArrayOf(0, -1)),
      mapOf(0x046d to byteArrayOf(1, 2)), false, 4000000L, false).appendTo(JSONObject(), 9000000L)
    assertFalse(item.getBoolean("isConnectable"))
    assertFalse(item.getBoolean("isLegacy"))
    assertEquals(5L, item.getLong("scanAgeMs"))
    assertEquals(4000000L, item.getLong("scanTimestampNanos"))
    assertEquals("00ff", item.getJSONArray("serviceData").getJSONObject(0).getString("hex"))
    assertEquals(0x046d, item.getJSONArray("manufacturerData").getJSONObject(0).getInt("manufacturerId"))
    assertFalse(item.has("rssi")); assertFalse(item.has("name")); assertFalse(item.has("isMuse"))
  }
  @Test fun boundsEveryPayloadAndReportsTruncation() {
    val services = (0..32).map { "uuid$it" }
    val data = (0..16).associate { "uuid$it" to ByteArray(129) { -1 } }
    val manufacturer = (0..16).associate { it to byteArrayOf(1) }
    val item = ScanAdvertisementMetadata(services, data, manufacturer, true, 9L).appendTo(JSONObject(), 1L)
    assertEquals(32, item.getJSONArray("serviceUuids").length())
    assertEquals(16, item.getJSONArray("serviceData").length())
    assertEquals(16, item.getJSONArray("manufacturerData").length())
    val first = item.getJSONArray("serviceData").getJSONObject(0)
    assertEquals(256, first.getString("hex").length); assertEquals(129, first.getInt("actualLength"))
    assertTrue(first.getBoolean("truncated")); assertTrue(item.getBoolean("advertisementTruncated"))
    assertEquals(0L, item.getLong("scanAgeMs"))
  }
  @Test fun rejectsOnlyExplicitNonConnectableUnbondedSelection() {
    assertFalse(ScanAdvertisementMetadata.canConnect(false, false))
    assertTrue(ScanAdvertisementMetadata.canConnect(false, true))
    assertTrue(ScanAdvertisementMetadata.canConnect(true, false))
    assertTrue(ScanAdvertisementMetadata.canConnect(null, true))
    assertTrue(ScanAdvertisementMetadata.canConnect(null, false))
  }
}
