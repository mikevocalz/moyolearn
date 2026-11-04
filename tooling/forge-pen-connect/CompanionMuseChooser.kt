package com.margelo.nitro.forgebluetooth.ble

import android.annotation.SuppressLint
import android.app.Activity
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.le.ScanResult
import android.companion.AssociationInfo
import android.companion.AssociationRequest
import android.companion.BluetoothLeDeviceFilter
import android.companion.CompanionDeviceManager
import android.content.Context
import android.content.Intent
import android.content.IntentSender
import android.os.Build
import android.os.Handler
import android.os.Parcelable
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.ReactApplicationContext
import com.margelo.nitro.core.Promise
import org.json.JSONObject
import java.util.concurrent.atomic.AtomicInteger
import java.util.regex.Pattern

/** One public OS chooser request; never connects, bonds or handles pairing secrets. */
@SuppressLint("MissingPermission")
internal class CompanionMuseChooser(
  private val context: ReactApplicationContext,
  private val main: Handler,
  private val generation: Long,
  private val onSelected: (BluetoothDevice, ScanResult?, Int?) -> String,
) {
  companion object {
    private val requestCodes = AtomicInteger(0x6d00)
  }
  private val promise = Promise<String>()
  private val requestCode = requestCodes.getAndIncrement().also { check(it <= 0xffff) { "System chooser request-code budget exhausted; reopen application" } }
  private var activity: Activity? = null
  private val completion = CompanionChooserCompletion()
  private var launched = false
  private var registered = false
  private var association: AssociationInfo? = null
  private var lastResultCode: Int? = null
  private var confirmedAssociationId: Int? = null
  @Volatile private var receipt = JSONObject().put("generation", generation).put("state", "idle").toString()
  private val timeout = Runnable { cancel("System chooser timed out") }
  private val lifecycle = object : LifecycleEventListener {
    override fun onHostResume() {}
    override fun onHostPause() {} // The OS chooser legitimately backgrounds React.
    override fun onHostDestroy() { cancel("Chooser host activity was destroyed") }
  }
  private val listener = object : BaseActivityEventListener() {
    override fun onActivityResult(source: Activity, code: Int, result: Int, data: Intent?) {
      if (completion.settled || code != requestCode || source !== activity) return
      update("activity-result", result)
      if (result != Activity.RESULT_OK) { cancel("System chooser cancelled or declined (result $result)"); return }
      val info = if (Build.VERSION.SDK_INT >= 33) data?.getParcelableExtra(CompanionDeviceManager.EXTRA_ASSOCIATION, AssociationInfo::class.java) ?: association else null
      completeVerified(info, legacySelection(data), result, "activity-result")
    }
  }

  private fun completeVerified(info: AssociationInfo?, legacy: Parcelable?, resultCode: Int?, source: String) {
    if (completion.settled) return
    try {
      val json = completion.complete(source, resultCode) {
      val manager = context.getSystemService(CompanionDeviceManager::class.java)
        ?: throw IllegalStateException("Companion device service unavailable")
      val scan = if (Build.VERSION.SDK_INT >= 34) info?.associatedDevice?.bleDevice else legacy as? ScanResult
      val selected = scan?.device ?: legacy as? BluetoothDevice ?: if (Build.VERSION.SDK_INT >= 33) {
        info?.deviceMacAddress?.let { mac ->
          (context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager).adapter.getRemoteDevice(mac.toString())
        }
      } else null
      val device = selected ?: throw IllegalStateException("System chooser returned no actual Bluetooth selection")
      val verified = if (Build.VERSION.SDK_INT >= 33) {
        info != null && manager.myAssociations.any { it.id == info.id && it.deviceMacAddress?.toString().equals(device.address, true) }
      } else legacyAssociationContains(manager, device.address)
      check(verified) { "System selection has no matching association owned by this application" }
      val name = scan?.scanRecord?.deviceName ?: device.name
      check(name != null && Pattern.compile(".*Muse.*", Pattern.CASE_INSENSITIVE).matcher(name).matches()) { "System selection did not match the requested Muse name filter" }
      // Hybrid's owner-generation check also runs inside candidate publication.
      onSelected(device, scan, if (Build.VERSION.SDK_INT >= 33) info?.id else null)
      } ?: return
      update("associated", resultCode, if (Build.VERSION.SDK_INT >= 33) info?.id else null)
      finish(false)
      promise.resolve(JSONObject(json).put("completionSource", source).toString())
    } catch (error: Exception) { cancel(error.message ?: "Unable to verify system chooser selection") }
  }

  fun snapshot(): String = receipt

  private fun update(state: String, resultCode: Int? = null, associationId: Int? = null, error: String? = null) {
    if (resultCode != null) lastResultCode = resultCode
    if (associationId != null) confirmedAssociationId = associationId
    receipt = JSONObject().put("generation", generation).put("state", state)
      .put("resultCode", lastResultCode ?: JSONObject.NULL).put("associationId", confirmedAssociationId ?: JSONObject.NULL)
      .put("error", error ?: JSONObject.NULL).put("completionSource", completion.source ?: JSONObject.NULL)
      .put("timestampMs", System.currentTimeMillis()).toString()
  }

  @Suppress("DEPRECATION")
  private fun legacySelection(data: Intent?): Parcelable? = data?.getParcelableExtra(CompanionDeviceManager.EXTRA_DEVICE)
  @Suppress("DEPRECATION")
  private fun legacyAssociationContains(manager: CompanionDeviceManager, address: String): Boolean = manager.associations.any { it.equals(address, true) }

  fun start(): Promise<String> {
    try {
      val host = context.currentActivity ?: throw IllegalStateException("Open the pen dialog in a foreground activity first")
      check(!host.isFinishing && !host.isDestroyed) { "Chooser host activity is closing" }
      val manager = context.getSystemService(CompanionDeviceManager::class.java)
        ?: throw IllegalStateException("Companion device service unavailable")
      activity = host
      context.addActivityEventListener(listener)
      context.addLifecycleEventListener(lifecycle)
      registered = true
      main.postDelayed(timeout, 120000L)
      val filter = BluetoothLeDeviceFilter.Builder().setNamePattern(Pattern.compile(".*Muse.*", Pattern.CASE_INSENSITIVE)).build()
      val request = AssociationRequest.Builder().addDeviceFilter(filter).setSingleDevice(true).build()
      val callback = object : CompanionDeviceManager.Callback() {
        private fun launch(sender: IntentSender) {
          if (completion.settled || launched) return
          try {
            val current = activity ?: throw IllegalStateException("Chooser host unavailable")
            launched = true
            update("chooser-open")
            current.startIntentSenderForResult(sender, requestCode, null, 0, 0, 0)
          } catch (error: Exception) { cancel(error.message ?: "System chooser could not open") }
        }
        @Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")
        override fun onDeviceFound(sender: IntentSender) { launch(sender) }
        override fun onAssociationPending(sender: IntentSender) { launch(sender) }
        override fun onAssociationCreated(info: AssociationInfo) {
          if (completion.settled) return
          association = info
          completeVerified(info, null, null, "association-callback")
        }
        override fun onFailure(error: CharSequence?) { if (!completion.settled) cancel(error?.toString() ?: "System chooser failed") }
      }
      update("requesting")
      @Suppress("DEPRECATION")
      manager.associate(request, callback, main)
    } catch (error: Exception) { cancel(error.message ?: "System chooser unavailable") }
    return promise
  }

  private fun finish(closeUi: Boolean) {
    completion.cancel()
    main.removeCallbacks(timeout)
    if (registered) {
      context.removeActivityEventListener(listener)
      context.removeLifecycleEventListener(lifecycle)
      registered = false
    }
    val old = activity
    activity = null
    if (closeUi && launched && old != null) {
      @Suppress("DEPRECATION")
      try { old.finishActivity(requestCode) } catch (_: Exception) { /* Local ownership still ends. */ }
    }
  }

  fun cancel(reason: String) {
    if (completion.settled) return
    update("cancelled", error = reason)
    finish(true)
    promise.reject(IllegalStateException(reason))
  }
}
