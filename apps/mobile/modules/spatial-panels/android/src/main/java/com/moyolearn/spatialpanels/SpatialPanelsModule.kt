package com.moyolearn.spatialpanels

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Opens and closes React Native components as separate headset panels
 * ([SpatialPanelActivity]). JS: `modules/spatial-panels`.
 */
class SpatialPanelsModule : Module() {
  private val listener =
    object : SpatialPanelRegistry.Listener {
      override fun onPanelOpened(name: String) {
        sendEvent(EVENT_OPENED, mapOf("name" to name))
      }

      override fun onPanelClosed(name: String, reason: PanelCloseReason) {
        sendEvent(EVENT_CLOSED, mapOf("name" to name, "reason" to reason.value))
      }
    }

  // The activity is declared in the pico flavor's manifest only, so this is
  // false on mobile and quest builds (quest uses Meta's layout SDK instead). Resolved once: the manifest cannot change
  // while the app runs.
  private val isAvailable: Boolean by lazy {
    appContext.reactContext?.declaresSpatialPanelActivity() ?: false
  }

  override fun definition() = ModuleDefinition {
    Name("SpatialPanels")

    Events(EVENT_OPENED, EVENT_CLOSED)

    Property("isAvailable") { isAvailable }

    AsyncFunction("openPanel") { name: String, props: Map<String, String>, widthDp: Int, heightDp: Int ->
      if (!isAvailable) {
        throw PanelUnavailableException()
      }
      SpatialPanelRegistry.setListener(listener)
      if (SpatialPanelRegistry.find(name) != null) return@AsyncFunction
      val activity = appContext.currentActivity ?: throw NoLaunchingActivityException(name)
      val bundle = Bundle()
      for ((key, value) in props) bundle.putString(key, value)
      activity.startActivity(SpatialPanelActivity.intent(activity, name, bundle), PicoPanelLaunchOptions.bundle(activity, widthDp, heightDp))
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("closePanel") { name: String ->
      SpatialPanelRegistry.find(name)?.closeFromApp()
    }.runOnQueue(Queues.MAIN)

    OnDestroy {
      Handler(Looper.getMainLooper()).post { SpatialPanelRegistry.setListener(null) }
    }
  }

  private companion object {
    const val EVENT_OPENED = "onPanelOpened"
    const val EVENT_CLOSED = "onPanelClosed"
  }
}
