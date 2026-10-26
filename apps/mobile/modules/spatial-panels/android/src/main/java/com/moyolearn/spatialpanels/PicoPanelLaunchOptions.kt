package com.moyolearn.spatialpanels

import android.app.Activity
import android.app.ActivityOptions
import android.content.ComponentName
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.DisplayMetrics

/**
 * The `ActivityOptions` that give a PICO OS 5 panel its own size.
 *
 * PICO OS 5 sizes a third-party app's 2D window from app-wide settings and
 * ignores the activity's `<layout>` (`AppRecord.initSize` reads
 * `ActivityInfo.windowLayout` only for system apps). The one per-launch input
 * it reads is `ActivityOptions` bundle `pico:activity.data` with
 * `override_app_width` / `override_app_height` in the panel's pixels
 * (`ExtActivityOptionsImpl.init`, then "use override app size" in
 * `AppRecord.initSize`; framework.jar and services.jar on a PICO 4 Ultra,
 * OS 5.15.7). Width and height must both be positive and must differ.
 *
 * The size is the panel's `pico.spatial.windowcontainer.defaultsize` meta-data
 * ("80x472", dp), converted at the launching window's density: the new panel's
 * display gets the same per-app density as the main one.
 */
internal object PicoPanelLaunchOptions {
  private const val PICO_DATA = "pico:activity.data"
  private const val WIDTH = "override_app_width"
  private const val HEIGHT = "override_app_height"
  private const val SIZE_META = "pico.spatial.windowcontainer.defaultsize"

  /** Null when the manifest declares no usable size; PICO's default size applies then. */
  fun bundle(source: Activity): Bundle? {
    val sizeDp = declaredSizeDp(source) ?: return null
    val density = source.resources.displayMetrics.densityDpi
    val width = sizeDp.first * density / DisplayMetrics.DENSITY_DEFAULT
    val height = sizeDp.second * density / DisplayMetrics.DENSITY_DEFAULT
    if (width <= 0 || height <= 0 || width == height) return null
    val data = Bundle().apply {
      putInt(WIDTH, width)
      putInt(HEIGHT, height)
    }
    return ActivityOptions.makeBasic().toBundle().apply { putBundle(PICO_DATA, data) }
  }

  private fun declaredSizeDp(source: Activity): Pair<Int, Int>? {
    val info =
      try {
        source.packageManager.getActivityInfo(
          ComponentName(source, SpatialPanelActivity::class.java),
          PackageManager.GET_META_DATA,
        )
      } catch (_: PackageManager.NameNotFoundException) {
        return null
      }
    val value = info.metaData?.getString(SIZE_META) ?: return null
    val match = Regex("""^(\d+)x(\d+)$""").matchEntire(value) ?: return null
    return match.groupValues[1].toInt() to match.groupValues[2].toInt()
  }
}
