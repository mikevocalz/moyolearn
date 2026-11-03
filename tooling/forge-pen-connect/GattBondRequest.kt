package com.margelo.nitro.forgebluetooth.ble

import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Handler
import com.margelo.nitro.core.Promise

/** Observes a user-requested OS pairing. It never handles PINs or custom auth. */
@SuppressLint("MissingPermission")
internal class GattBondRequest(
  private val context: Context,
  private val device: BluetoothDevice,
  private val main: Handler,
  private val onState: (Int) -> Unit,
) {
  private val promise = Promise<Int>()
  private var settled = false
  private var registered = false
  private val timeout = Runnable { cancel("System pairing timed out; the OS owns any remaining pairing UI") }
  private val receiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      if (settled || intent.action != BluetoothDevice.ACTION_BOND_STATE_CHANGED) return
      try {
        val source = if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice::class.java)
        else legacyDevice(intent)
        if (source == null || source != device) return
        // Query real OS state instead of trusting an intent's claimed result.
        val state = device.bondState
        onState(state)
        if (state == BluetoothDevice.BOND_BONDED) {
          finish(); promise.resolve(state)
        } else if (state == BluetoothDevice.BOND_NONE && intent.getIntExtra(BluetoothDevice.EXTRA_PREVIOUS_BOND_STATE, -1) == BluetoothDevice.BOND_BONDING) {
          cancel("System pairing failed or was declined")
        }
      } catch (error: Exception) { cancel(error.message ?: "Unable to observe pairing") }
    }
  }

  @Suppress("DEPRECATION")
  private fun legacyDevice(intent: Intent): BluetoothDevice? = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)

  fun start(): Promise<Int> {
    try {
      val state = device.bondState
      onState(state)
      if (state == BluetoothDevice.BOND_BONDED) { settled = true; promise.resolve(state); return promise }
      val filter = IntentFilter(BluetoothDevice.ACTION_BOND_STATE_CHANGED)
      // Bluetooth system broadcasts originate in a privileged non-system UID.
      // The action is protected; also require matching device + queried OS state.
      if (Build.VERSION.SDK_INT >= 33) context.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
      else context.registerReceiver(receiver, filter)
      registered = true
      main.postDelayed(timeout, 60000L)
      if (state == BluetoothDevice.BOND_NONE && !device.createBond()) cancel("Android rejected the pairing request")
    } catch (error: Exception) { cancel(error.message ?: "System pairing failed") }
    return promise
  }

  private fun finish() {
    settled = true
    main.removeCallbacks(timeout)
    if (registered) {
      registered = false
      try { context.unregisterReceiver(receiver) } catch (_: IllegalArgumentException) {}
    }
  }

  fun cancel(reason: String) {
    if (settled) return
    finish()
    // API34 has no public per-app cancelBondProcess; do not use hidden APIs.
    promise.reject(IllegalStateException(reason))
  }
}
