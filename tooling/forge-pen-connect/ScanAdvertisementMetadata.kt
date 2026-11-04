package com.margelo.nitro.forgebluetooth.ble

import org.json.JSONArray
import org.json.JSONObject

/** Bounded measured advertisement data; UUIDs/manufacturer IDs never assert identity. */
internal class ScanAdvertisementMetadata(
  private val serviceUuids: List<String>,
  private val serviceData: Map<String, ByteArray>,
  private val manufacturerData: Map<Int, ByteArray>,
  val connectable: Boolean,
  private val timestampNanos: Long,
  private val legacy: Boolean? = null,
) {
  fun appendTo(item: JSONObject, nowNanos: Long): JSONObject {
    legacy?.let { item.put("isLegacy", it) }
    item.put("isConnectable", connectable)
      .put("scanTimestampNanos", timestampNanos)
      .put("scanAgeMs", maxOf(0L, nowNanos - timestampNanos) / 1000000L)
      .put("serviceUuids", JSONArray(serviceUuids.take(32)))
    val services = JSONArray()
    for ((uuid, bytes) in serviceData.entries.sortedBy { it.key }.take(16)) {
      services.put(bytesJson(bytes).put("uuid", uuid))
    }
    val manufacturers = JSONArray()
    for ((id, bytes) in manufacturerData.entries.sortedBy { it.key }.take(16)) {
      manufacturers.put(bytesJson(bytes).put("manufacturerId", id))
    }
    return item.put("serviceData", services).put("manufacturerData", manufacturers)
      .put("advertisementTruncated", serviceUuids.size > 32 || serviceData.size > 16 || manufacturerData.size > 16 ||
        serviceData.values.any { it.size > 128 } || manufacturerData.values.any { it.size > 128 })
  }

  private fun bytesJson(bytes: ByteArray): JSONObject = JSONObject()
    .put("hex", bytes.take(128).joinToString("") { "%02x".format(it.toInt() and 0xff) })
    .put("actualLength", bytes.size).put("truncated", bytes.size > 128)

  companion object {
    /** Reject only actual explicit non-connectable ads; a genuine OS bond may reconnect. */
    fun canConnect(connectable: Boolean?, bonded: Boolean): Boolean = bonded || connectable != false
  }
}
