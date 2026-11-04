package com.margelo.nitro.forgebluetooth.ble

import org.json.JSONArray
import org.json.JSONObject
import java.util.ArrayDeque
import java.util.concurrent.atomic.AtomicLong

/** Bounded measured bytes; never labels a packet as a button or pen sample. */
internal class GattDiagnosticEventBuffer(private val generation: Long, private val sequence: AtomicLong) {
  private val events = ArrayDeque<JSONObject>()
  fun append(kind: String, key: String?, status: Int?, value: ByteArray?, actualLength: Int,
    message: String?, wallTimeMs: Long, elapsedRealtimeMs: Long) {
    val entry = JSONObject().put("sequence", sequence.incrementAndGet()).put("connectionGeneration", generation)
      .put("wallTimeMs", wallTimeMs).put("elapsedRealtimeMs", elapsedRealtimeMs).put("kind", kind)
    if (key != null) entry.put("characteristicKey", key)
    if (status != null) entry.put("status", status)
    if (message != null) entry.put("message", message)
    if (value != null) entry.put("hex", value.take(512).joinToString("") { "%02x".format(it.toInt() and 255) })
      .put("byteLength", actualLength).put("truncated", actualLength > 512)
    if (events.size == 128) events.removeFirst()
    events.addLast(entry)
  }
  fun snapshot(): JSONArray = JSONArray(events.toList())
}
