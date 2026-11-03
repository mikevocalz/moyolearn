package com.margelo.nitro.forgebluetooth.ble

import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import com.margelo.nitro.core.Promise

/** One Android ATT request at a time; variants own their exact callback object. */
internal sealed class GattDiagnosticOperation(val kind: String, val key: String?) {
  val promise = Promise<String>()
  var timeout: Runnable? = null
  class Discover : GattDiagnosticOperation("discover", null)
  class Read(val characteristic: BluetoothGattCharacteristic, key: String) : GattDiagnosticOperation("read", key)
  class ReadDescriptor(val descriptor: BluetoothGattDescriptor, key: String) : GattDiagnosticOperation("read-descriptor", key)
  class Subscribe(val characteristic: BluetoothGattCharacteristic, val descriptor: BluetoothGattDescriptor,
    val characteristicKey: String, val enabled: Boolean, val mode: String) : GattDiagnosticOperation("subscribe", characteristicKey)
}
