package com.margelo.nitro.forgebluetooth.ble

import android.annotation.SuppressLint
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothStatusCodes
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import com.margelo.nitro.core.Promise
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.atomic.AtomicLong

/** All mutable diagnostic state belongs to the provided main handler. No pen decoding. */
@SuppressLint("MissingPermission")
internal class GattDiagnosticsSession(
  private val gatt: BluetoothGatt,
  private val context: Context,
  private val generation: Long,
  private val main: Handler,
  private val sequence: AtomicLong,
) {
  private var connected = true
  private var capturing = false
  private val gate = GattDiagnosticRequestGate<GattDiagnosticOperation>()
  private val blocked: Boolean get() = gate.blocked
  private var servicesState = "idle"
  private var inventory = JSONArray()
  private var inventoryTruncated = false
  private val characteristics = LinkedHashMap<String, BluetoothGattCharacteristic>()
  private val descriptors = LinkedHashMap<String, BluetoothGattDescriptor>()
  private val subscriptions = LinkedHashMap<String, String>()
  private val events = GattDiagnosticEventBuffer(generation, sequence)
  private var spatialVersion: Pair<BluetoothGattCharacteristic, ByteArray>? = null
  private var totalNotifications = 0L
  private var bondRequest: GattBondRequest? = null
  @Volatile private var cached = JSONObject().put("version", 1).put("connected", true)
    .put("connectionGeneration", generation).put("bondState", -1).put("snapshotTimeMs", System.currentTimeMillis())
    .put("capturing", false).put("blocked", false).put("servicesState", "idle").put("services", JSONArray())
    .put("inventoryTruncated", false).put("operation", JSONObject.NULL).put("subscriptions", JSONArray())
    .put("events", JSONArray()).put("totalNotifications", 0).put("lastSequence", sequence.get()).toString()

  private fun owner(block: () -> Unit) {
    if (Looper.myLooper() == main.looper) block() else main.post { block() }
  }

  fun snapshot(): String {
    // Refresh the measured bond state on the owner, never mutate state from JS.
    owner { publish() }
    return cached
  }

  private fun publish() {
    val bond = try { gatt.device.bondState } catch (_: SecurityException) { -1 }
    val op = gate.active
    val active = if (op == null) { if (bondRequest != null) JSONObject().put("kind", "bond") else JSONObject.NULL } else JSONObject().put("kind", op.kind).put("characteristicKey", op.key)
    cached = JSONObject().put("version", 1).put("connected", connected)
      .put("connectionGeneration", generation).put("bondState", bond).put("snapshotTimeMs", System.currentTimeMillis())
      .put("capturing", capturing).put("blocked", blocked).put("servicesState", servicesState)
      .put("services", inventory).put("inventoryTruncated", inventoryTruncated).put("operation", active)
      .put("subscriptions", JSONArray(subscriptions.map { (key, mode) -> JSONObject().put("characteristicKey", key).put("mode", mode) }))
      .put("events", events.snapshot()).put("totalNotifications", totalNotifications)
      .put("lastSequence", sequence.get()).toString()
  }

  private fun event(kind: String, key: String? = null, status: Int? = null, value: ByteArray? = null,
    actualLength: Int = value?.size ?: 0, message: String? = null,
    wallTimeMs: Long = System.currentTimeMillis(), elapsedRealtimeMs: Long = SystemClock.elapsedRealtime()) {
    events.append(kind, key, status, value, actualLength, message, wallTimeMs, elapsedRealtimeMs)
    publish()
  }

  private fun fail(op: GattDiagnosticOperation, message: String, status: Int? = null, cause: Exception? = null) {
    if (gate.active !== op) return
    op.timeout?.let { main.removeCallbacks(it) }
    if (cause != null && op is GattDiagnosticOperation.ConfigureSpatialHost) gate.quarantine(op)
    if (cause == null) gate.finish(op) else gate.startFailed(op, cause)
    if (op is GattDiagnosticOperation.Discover) servicesState = "error"
    event("error", op.key, status, message = message)
    op.promise.reject(IllegalStateException(message))
  }

  private fun finish(op: GattDiagnosticOperation) {
    if (gate.active !== op) return
    op.timeout?.let { main.removeCallbacks(it) }
    gate.finish(op)
    publish()
    op.promise.resolve(cached)
  }

  private fun begin(op: GattDiagnosticOperation, start: () -> Boolean): Promise<String> {
    owner {
      if (!connected || blocked || gate.active != null || bondRequest != null) {
        op.promise.reject(IllegalStateException(if (blocked) "Diagnostic session requires reconnect after cancellation/timeout" else "GATT disconnected or another diagnostic operation is pending"))
        return@owner
      }
      check(gate.start(op))
      val timeout = Runnable {
        if (gate.active === op) {
          // Android has no per-request cancellation; quarantine late callbacks.
          gate.quarantine(op)
          fail(op, "GATT ${op.kind} timed out; reconnect before another operation")
        }
      }
      op.timeout = timeout
      main.postDelayed(timeout, 15000L)
      try {
        if (!start()) fail(op, "Android rejected GATT ${op.kind} request")
        else publish()
      } catch (error: Exception) {
        val message = if (error is SecurityException) {
          (error.message ?: "Android denied GATT access") +
            "; diagnostic session requires disconnect/reconnect because Android may retain its ATT busy state"
        } else error.message ?: "GATT operation failed"
        fail(op, message, cause = error)
      }
    }
    return op.promise
  }

  fun discover(): Promise<String> {
    val op = GattDiagnosticOperation.Discover()
    return begin(op) {
      capturing = true
      spatialVersion = null
      servicesState = "discovering"
      gatt.discoverServices()
    }
  }

  fun read(key: String): Promise<String> {
    // Resolve the actual inventory object on the owner, before starting ATT.
    val result = Promise<String>()
    owner {
      val characteristic = characteristics[key]
      if (servicesState != "ready" || characteristic == null || characteristic.properties and BluetoothGattCharacteristic.PROPERTY_READ == 0) {
        result.reject(IllegalArgumentException("Select a discovered READ characteristic")); return@owner
      }
      begin(GattDiagnosticOperation.Read(characteristic, key)) { gatt.readCharacteristic(characteristic) }
        .then { result.resolve(it) }.catch { result.reject(it) }
    }
    return result
  }

  /** Only the documented volatile ASA 1.1 host negotiation, never arbitrary writes. */
  fun configureSpatialAccessoryHost(): Promise<String> {
    val result = Promise<String>()
    owner {
      try {
        val version = spatialVersion ?: throw IllegalStateException("Read the current Apple Spatial Accessory Version successfully first")
        check(servicesState == "ready" && characteristics.values.any { it === version.first }) { "Discover and read the current accessory version first" }
        val service = version.first.service
        val host = service.getCharacteristic(UUID.fromString("3c7f9bdc-3bcb-a75f-c969-9bbd7f058f2b"))
          ?: throw IllegalArgumentException("Current ASA service has no Host Version characteristic")
        check(host.properties and BluetoothGattCharacteristic.PROPERTY_WRITE != 0) { "Host Version does not support acknowledged WRITE" }
        val key = characteristics.entries.firstOrNull { it.value === host }?.key
          ?: throw IllegalArgumentException("Host Version is not in the current discovered inventory")
        val bytes = SpatialAccessoryVersionPolicy.createHostVersion(version.second)
        val op = GattDiagnosticOperation.ConfigureSpatialHost(host, key, bytes)
        begin(op) {
          if (Build.VERSION.SDK_INT >= 33) gatt.writeCharacteristic(host, bytes, BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT) == BluetoothStatusCodes.SUCCESS
          else writeLegacyCharacteristic(host, bytes)
        }.then { result.resolve(it) }.catch { result.reject(it) }
      } catch (error: Exception) { result.reject(error) }
    }
    return result
  }

  @Suppress("DEPRECATION")
  private fun writeLegacyCharacteristic(characteristic: BluetoothGattCharacteristic, bytes: ByteArray): Boolean {
    characteristic.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
    characteristic.value = bytes
    return gatt.writeCharacteristic(characteristic)
  }

  fun onCharacteristicWrite(source: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) = owner {
    val op = gate.active as? GattDiagnosticOperation.ConfigureSpatialHost ?: return@owner
    if (!connected || source !== gatt || op.characteristic !== characteristic) return@owner
    event("spatial-host-write", op.key, status, op.bytes, message = "Documented ASA host session negotiation; does not verify input")
    if (status == BluetoothGatt.GATT_SUCCESS) finish(op) else fail(op, "ASA Host Version write failed, status $status", status)
  }

  fun readDescriptor(key: String): Promise<String> {
    val result = Promise<String>()
    owner {
      val descriptor = descriptors[key]
      if (servicesState != "ready" || descriptor == null) {
        result.reject(IllegalArgumentException("Select an actual discovered descriptor")); return@owner
      }
      begin(GattDiagnosticOperation.ReadDescriptor(descriptor, key)) { gatt.readDescriptor(descriptor) }
        .then { result.resolve(it) }.catch { result.reject(it) }
    }
    return result
  }

  fun setNotification(key: String, enabled: Boolean): Promise<String> {
    val result = Promise<String>()
    owner {
      val characteristic = characteristics[key]
      val descriptor = characteristic?.getDescriptor(UUID.fromString("00002902-0000-1000-8000-00805f9b34fb"))
      val properties = characteristic?.properties ?: 0
      val mode = when {
        properties and BluetoothGattCharacteristic.PROPERTY_NOTIFY != 0 -> "notify"
        properties and BluetoothGattCharacteristic.PROPERTY_INDICATE != 0 -> "indicate"
        else -> null
      }
      if (servicesState != "ready" || characteristic == null || descriptor == null || mode == null || (!enabled && !subscriptions.containsKey(key))) {
        result.reject(IllegalArgumentException("Select an actual discovered NOTIFY/INDICATE characteristic with CCCD; disable only this session's subscriptions")); return@owner
      }
      val op = GattDiagnosticOperation.Subscribe(characteristic, descriptor, key, enabled, mode)
      begin(op) {
        if (!gatt.setCharacteristicNotification(characteristic, enabled)) false
        else {
          if (enabled) capturing = true
          val bytes = if (!enabled) BluetoothGattDescriptor.DISABLE_NOTIFICATION_VALUE else if (mode == "notify") BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE else BluetoothGattDescriptor.ENABLE_INDICATION_VALUE
          val accepted = if (Build.VERSION.SDK_INT >= 33) gatt.writeDescriptor(descriptor, bytes) == BluetoothStatusCodes.SUCCESS
          else writeLegacyDescriptor(descriptor, bytes)
          if (!accepted && enabled) gatt.setCharacteristicNotification(characteristic, false)
          accepted
        }
      }.then { result.resolve(it) }.catch { result.reject(it) }
    }
    return result
  }

  @Suppress("DEPRECATION")
  private fun writeLegacyDescriptor(descriptor: BluetoothGattDescriptor, value: ByteArray): Boolean {
    descriptor.value = value
    return gatt.writeDescriptor(descriptor)
  }

  fun onServices(source: BluetoothGatt, status: Int) = owner {
    val op = gate.active as? GattDiagnosticOperation.Discover
    if (!connected || source !== gatt || op == null) return@owner
    if (status != BluetoothGatt.GATT_SUCCESS) { fail(op, "Service discovery failed, status $status", status); return@owner }
    spatialVersion = null
    characteristics.clear(); descriptors.clear(); inventory = JSONArray(); inventoryTruncated = false
    val allServices = source.services
    if (allServices.size > 64) inventoryTruncated = true
    var characteristicCount = 0
    var descriptorCount = 0
    for (service in allServices.take(64)) {
      val serviceKey = "${service.uuid}/${service.instanceId}"
      val chars = JSONArray()
      if (service.characteristics.size > 256) inventoryTruncated = true
      for (characteristic in service.characteristics) {
        if (characteristicCount >= 256) { inventoryTruncated = true; break }
        characteristicCount++
        val key = "$serviceKey/${characteristic.uuid}/${characteristic.instanceId}"
        characteristics[key] = characteristic
        val desc = JSONArray()
        if (characteristic.descriptors.size > 32) inventoryTruncated = true
        characteristic.descriptors.take(32).forEachIndexed { index, descriptor ->
          if (descriptorCount >= 1024) { inventoryTruncated = true; return@forEachIndexed }
          descriptorCount++
          val descriptorKey = "$key/${descriptor.uuid}/$index"
          descriptors[descriptorKey] = descriptor
          desc.put(JSONObject().put("key", descriptorKey).put("uuid", descriptor.uuid.toString()).put("permissions", descriptor.permissions))
        }
        chars.put(JSONObject().put("key", key).put("uuid", characteristic.uuid.toString()).put("instanceId", characteristic.instanceId)
          .put("properties", characteristic.properties).put("permissions", characteristic.permissions).put("descriptors", desc))
      }
      inventory.put(JSONObject().put("key", serviceKey).put("uuid", service.uuid.toString()).put("instanceId", service.instanceId).put("type", service.type).put("characteristics", chars))
    }
    servicesState = "ready"
    event("services", status = status, message = "Discovered ${allServices.size} actual services")
    finish(op)
  }

  fun onRead(source: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int, value: ByteArray) {
    val bytes = value.copyOf(minOf(value.size, 512)); val actual = value.size
    owner {
      val op = gate.active as? GattDiagnosticOperation.Read ?: return@owner
      if (!connected || source !== gatt || op.characteristic !== characteristic) return@owner
      event("read", op.key, status, bytes, actual)
      if (characteristic.service.uuid == UUID.fromString("e277e685-64cb-4a32-bf65-8766e708a037") &&
          characteristic.uuid == UUID.fromString("e3ab6c3d-3e94-7a2c-db59-b8b91723cad4")) {
        spatialVersion = if (status == BluetoothGatt.GATT_SUCCESS && actual < 512) Pair(characteristic, bytes.copyOf()) else null
      }
      if (status == BluetoothGatt.GATT_SUCCESS) finish(op) else fail(op, "Characteristic read failed, status $status", status)
    }
  }

  fun onDescriptorRead(source: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int, value: ByteArray) {
    val bytes = value.copyOf(minOf(value.size, 512)); val actual = value.size
    owner {
      val op = gate.active as? GattDiagnosticOperation.ReadDescriptor ?: return@owner
      if (!connected || source !== gatt || op.descriptor !== descriptor) return@owner
      event("descriptor-read", op.key, status, bytes, actual)
      if (status == BluetoothGatt.GATT_SUCCESS) finish(op) else fail(op, "Descriptor read failed, status $status", status)
    }
  }

  fun onDescriptorWrite(source: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) = owner {
    val op = gate.active as? GattDiagnosticOperation.Subscribe ?: return@owner
    if (!connected || source !== gatt || op.descriptor !== descriptor) return@owner
    if (status == BluetoothGatt.GATT_SUCCESS) {
      if (op.enabled) subscriptions[op.characteristicKey] = op.mode else subscriptions.remove(op.characteristicKey)
      event("descriptor-write", op.key, status, message = if (op.enabled) "Standard CCCD ${op.mode} enabled" else "Standard CCCD disabled")
      finish(op)
    } else {
      if (op.enabled) try { gatt.setCharacteristicNotification(op.characteristic, false) } catch (_: Exception) {}
      fail(op, "CCCD write failed, status $status", status)
    }
  }

  fun onNotification(source: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray) {
    val bytes = value.copyOf(minOf(value.size, 512)); val actual = value.size
    val wall = System.currentTimeMillis(); val elapsed = SystemClock.elapsedRealtime()
    owner {
      if (!connected || !capturing || source !== gatt) return@owner
      val key = characteristics.entries.firstOrNull { it.value === characteristic }?.key ?: return@owner
      totalNotifications++
      event("notification", key, value = bytes, actualLength = actual, wallTimeMs = wall, elapsedRealtimeMs = elapsed)
    }
  }

  fun requestBond(): Promise<String> {
    val result = Promise<String>()
    owner {
      if (!connected || gate.active != null || bondRequest != null) {
        result.reject(IllegalStateException("Connect a device and finish the current operation before pairing")); return@owner
      }
      val request = GattBondRequest(context, gatt.device, main) { state ->
        event("bond-state", status = state, message = "Actual Android bond state")
      }
      bondRequest = request
      publish()
      request.start().then {
        if (bondRequest === request) {
          bondRequest = null; publish(); result.resolve(cached)
        }
      }.catch { error ->
        if (bondRequest === request) {
          bondRequest = null; event("error", message = error.message ?: "Pairing failed"); result.reject(error)
        }
      }
    }
    return result
  }

  fun stop() = owner {
    capturing = false
    for (key in subscriptions.keys) characteristics[key]?.let { try { gatt.setCharacteristicNotification(it, false) } catch (_: Exception) {} }
    (gate.active as? GattDiagnosticOperation.Subscribe)?.let {
      try { gatt.setCharacteristicNotification(it.characteristic, false) } catch (_: Exception) {}
    }
    gate.active?.let { gate.quarantine(it); fail(it, "Diagnostic capture cancelled; reconnect before another operation") }
    event("capture-stopped", message = "Local notifications disabled; remote CCCD cleanup requires explicit unsubscribe or disconnect")
  }

  fun close(reason: String) = owner {
    if (!connected) return@owner
    connected = false; capturing = false; spatialVersion = null
    bondRequest?.cancel(reason)
    gate.active?.let { fail(it, reason) }
    subscriptions.clear()
    event("disconnected", message = reason)
  }
}
