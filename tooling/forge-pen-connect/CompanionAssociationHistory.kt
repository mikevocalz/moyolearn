package com.margelo.nitro.forgebluetooth.ble

import android.annotation.SuppressLint
import android.bluetooth.BluetoothManager
import android.companion.CompanionDeviceManager
import android.content.Context
import android.os.Build
import java.util.regex.Pattern

/** Reads only this application's public OS associations; never creates or removes one. */
@SuppressLint("MissingPermission")
internal class CompanionAssociationHistory(private val context: Context) {
  fun listMuse(): List<AssociatedMuseDevice> {
    val manager = context.getSystemService(CompanionDeviceManager::class.java)
      ?: throw IllegalStateException("Companion device service unavailable")
    val adapter = (context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter
      ?: throw IllegalStateException("Bluetooth adapter unavailable")
    val pattern = Pattern.compile(".*Muse.*", Pattern.CASE_INSENSITIVE)
    val candidates = LinkedHashMap<String, AssociatedMuseDevice>()
    if (Build.VERSION.SDK_INT >= 33) {
      for (info in manager.myAssociations.sortedByDescending { it.id }) {
        if (info.isSelfManaged) continue
        val mac = info.deviceMacAddress ?: continue
        val device = if (Build.VERSION.SDK_INT >= 34) info.associatedDevice?.bleDevice?.device
          ?: adapter.getRemoteDevice(mac.toString()) else adapter.getRemoteDevice(mac.toString())
        if (!device.address.equals(mac.toString(), true)) continue
        val name = info.displayName?.toString()?.takeIf { it.isNotBlank() } ?: device.name ?: continue
        if (!pattern.matcher(name).matches()) continue
        if (!candidates.containsKey(device.address)) candidates[device.address] = AssociatedMuseDevice(device, name, info.id)
        if (candidates.size >= 50) break
      }
    } else {
      @Suppress("DEPRECATION")
      val owned = manager.associations
      for (mac in owned) {
        val device = adapter.getRemoteDevice(mac)
        val name = device.name ?: continue
        if (pattern.matcher(name).matches()) candidates[device.address] = AssociatedMuseDevice(device, name, null)
        if (candidates.size >= 50) break
      }
    }
    return candidates.values.toList()
  }
}
