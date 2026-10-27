package com.moyolearn.spatialpanels

import android.content.Context
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener

/** Registers [PicoMainWindowListener] with the app's ReactActivity. */
class SpatialPanelsPackage : Package {
  override fun createReactActivityLifecycleListeners(activityContext: Context?): List<ReactActivityLifecycleListener> =
    listOf(PicoMainWindowListener())
}
