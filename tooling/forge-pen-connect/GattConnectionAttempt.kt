package com.margelo.nitro.forgebluetooth.ble

import android.bluetooth.BluetoothGatt
import com.margelo.nitro.core.Promise
import java.util.concurrent.atomic.AtomicBoolean

/** Identity retained after connection so stale callbacks cannot change a new link. */
internal class GattConnectionAttempt(val generation: Long) {
  @Volatile var diagnostics: GattDiagnosticsSession? = null
  val promise = Promise<Boolean>()
  val settled = AtomicBoolean(false)
  @Volatile var gatt: BluetoothGatt? = null
  var timeout: Runnable? = null
}
