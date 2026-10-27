package com.moyolearn.spatialpanels

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager

/**
 * True when this app's manifest declares [SpatialPanelActivity], which only the
 * pico flavor does (the `spatial-panels` config plugin writes it there). The
 * build fact every pico-only path in this module reads.
 */
internal fun Context.declaresSpatialPanelActivity(): Boolean {
  try {
    packageManager.getActivityInfo(ComponentName(this, SpatialPanelActivity::class.java), 0)
    return true
  } catch (_: PackageManager.NameNotFoundException) {
    return false
  }
}
