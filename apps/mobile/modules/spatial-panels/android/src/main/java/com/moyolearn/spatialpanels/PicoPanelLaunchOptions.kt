package com.moyolearn.spatialpanels

import android.app.Activity
import android.app.ActivityOptions
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
 * The dp size comes from JS (the same window props Quest opens at) and is
 * converted at the launching window's density: the new panel's display gets
 * the same per-app density as the main one.
 */
internal object PicoPanelLaunchOptions {
  private const val PICO_DATA = "pico:activity.data"
  private const val WIDTH = "override_app_width"
  private const val HEIGHT = "override_app_height"

  fun bundle(source: Activity, widthDp: Int, heightDp: Int): Bundle {
    require(widthDp > 0 && heightDp > 0) { "Panel size must be positive, got ${widthDp}x$heightDp dp." }
    val density = source.resources.displayMetrics.densityDpi
    val width = widthDp * density / DisplayMetrics.DENSITY_DEFAULT
    val height = heightDp * density / DisplayMetrics.DENSITY_DEFAULT
    require(width != height) { "PICO ignores a square override size (${width}x$height px)." }
    val data = Bundle().apply {
      putInt(WIDTH, width)
      putInt(HEIGHT, height)
    }
    return ActivityOptions.makeBasic().toBundle().apply { putBundle(PICO_DATA, data) }
  }
}
