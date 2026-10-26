package com.moyolearn.spatialpanels

import android.app.Activity
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.ColorDrawable
import android.os.Bundle
import expo.modules.core.interfaces.ReactActivityLifecycleListener

/**
 * Makes the main activity's window transparent on the pico build.
 *
 * On PICO the main window holds the shell rail in a strip left of the main
 * panel (`PicoMainFrame` in src/spatial/panelWindows.tsx), because PICO OS 5
 * cannot attach a second activity window to the first. The strip and the
 * panel's rounded corners must show passthrough, not the theme's window
 * background. PICO OS 5 composites a window's alpha (the panel activity relies
 * on the same), so a translucent format and a transparent background are
 * enough. Other flavors keep their opaque window.
 */
internal class PicoMainWindowListener : ReactActivityLifecycleListener {
  override fun onCreate(activity: Activity, savedInstanceState: Bundle?) {
    if (!activity.declaresSpatialPanelActivity()) return
    makeTransparent(activity)
  }

  // The splash screen swaps the theme once the first frame is ready; re-apply
  // after the content view is set so the post-splash theme's background does
  // not come back.
  override fun onContentChanged(activity: Activity) {
    if (!activity.declaresSpatialPanelActivity()) return
    makeTransparent(activity)
  }

  private fun makeTransparent(activity: Activity) {
    activity.window.setFormat(PixelFormat.TRANSLUCENT)
    activity.window.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
  }
}
