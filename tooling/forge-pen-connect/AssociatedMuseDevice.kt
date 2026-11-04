package com.margelo.nitro.forgebluetooth.ble

import android.bluetooth.BluetoothDevice

/** Actual own OS association; its address may no longer be an advertising RPA. */
internal data class AssociatedMuseDevice(val device: BluetoothDevice, val name: String, val associationId: Int?)
