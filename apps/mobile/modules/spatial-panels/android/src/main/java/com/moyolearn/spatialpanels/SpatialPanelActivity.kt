package com.moyolearn.spatialpanels

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.ViewGroup
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import com.facebook.react.ReactApplication
import com.facebook.react.interfaces.fabric.ReactSurface

/**
 * A headset panel that renders one registered React Native component as a
 * second surface on the app's ReactHost, so it shares the main window's JS
 * runtime and stores.
 *
 * Declared in the pico flavor manifest only (the `spatial-panels` config
 * plugin writes it), in its own task. PICO OS 5 gives it its own 2D window
 * only because its `pico.vr.position` differs from MainActivity's; the size
 * comes from the launch options ([PicoPanelLaunchOptions]). The OS picks where
 * it opens; the app cannot pin it to the main panel's edge.
 *
 * Deliberately not a `ReactActivity`: ReactHost tracks a single current
 * activity, asserts in `onHostPause` when a different one pauses, and moves
 * the whole React context to host-destroyed when the current activity is
 * destroyed (RN 0.88 `ReactHostImpl`). This activity never reports host
 * lifecycle, so the main window stays the ReactHost's activity while the
 * panel opens, pauses and closes.
 */
class SpatialPanelActivity : ComponentActivity() {
  private var surface: ReactSurface? = null
  private var componentName: String? = null
  private var closeReason = PanelCloseReason.User

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val name = intent.getStringExtra(EXTRA_COMPONENT)
    val host = (application as? ReactApplication)?.reactHost
    if (name.isNullOrEmpty() || host == null) {
      Log.e(TAG, "Cannot open a panel: component=$name, reactHost=${host != null}.")
      finishAndRemoveTask()
      return
    }
    componentName = name

    val created = host.createSurface(this, name, intent.getBundleExtra(EXTRA_PROPS))
    val view = checkNotNull(created.view) { "ReactHost.createSurface returned a surface without a view." }
    setContentView(
      view,
      ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT),
    )
    created.start()
    surface = created

    // Back closes the panel. The ReactHost's back handler belongs to the main
    // window, so it is not forwarded.
    onBackPressedDispatcher.addCallback(
      this,
      object : OnBackPressedCallback(true) {
        override fun handleOnBackPressed() {
          finishAndRemoveTask()
        }
      },
    )

    SpatialPanelRegistry.opened(name, this)
  }

  /** Closes this panel at JS's request; the close event reports [PanelCloseReason.App]. */
  fun closeFromApp() {
    closeReason = PanelCloseReason.App
    finishAndRemoveTask()
  }

  override fun onDestroy() {
    surface?.let {
      it.stop()
      it.detach()
    }
    surface = null
    componentName?.let { SpatialPanelRegistry.closed(it, this, closeReason) }
    super.onDestroy()
  }

  companion object {
    private const val TAG = "SpatialPanelActivity"
    private const val EXTRA_COMPONENT = "com.moyolearn.spatialpanels.COMPONENT"
    private const val EXTRA_PROPS = "com.moyolearn.spatialpanels.PROPS"

    /**
     * Android's multi-window launch (Meta documents the same flags for a
     * multi-panel activity):
     * `FLAG_ACTIVITY_LAUNCH_ADJACENT | FLAG_ACTIVITY_NEW_TASK |
     * FLAG_ACTIVITY_MULTIPLE_TASK`.
     */
    fun intent(context: Context, componentName: String, props: Bundle): Intent =
      Intent(context, SpatialPanelActivity::class.java)
        .putExtra(EXTRA_COMPONENT, componentName)
        .putExtra(EXTRA_PROPS, props)
        .addFlags(
          Intent.FLAG_ACTIVITY_LAUNCH_ADJACENT or
            Intent.FLAG_ACTIVITY_NEW_TASK or
            Intent.FLAG_ACTIVITY_MULTIPLE_TASK,
        )
  }
}
