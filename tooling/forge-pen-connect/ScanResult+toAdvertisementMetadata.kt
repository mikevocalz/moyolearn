package com.margelo.nitro.forgebluetooth.ble

import android.bluetooth.le.ScanResult

internal fun ScanResult.toAdvertisementMetadata(): ScanAdvertisementMetadata {
  val record = scanRecord
  val manufacturerData = LinkedHashMap<Int, ByteArray>()
  record?.manufacturerSpecificData?.let { data ->
    for (index in 0 until data.size()) manufacturerData[data.keyAt(index)] = data.valueAt(index).copyOf()
  }
  return ScanAdvertisementMetadata(
    record?.serviceUuids?.map { it.toString() } ?: emptyList(),
    record?.serviceData?.entries?.associate { it.key.toString() to it.value.copyOf() } ?: emptyMap(),
    manufacturerData, isConnectable, timestampNanos, isLegacy)
}
