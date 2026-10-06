package com.moyolearn.boardtexture

import android.app.Activity
import android.app.Application
import android.content.Context
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import com.viro.core.ViroView
import java.lang.ref.WeakReference
import java.util.concurrent.CopyOnWriteArraySet

/**
 * The renderer's own view, found from anywhere in the process.
 *
 * `AndroidViewTexture` needs a `ViroView` for two things — the `ViroContext`
 * the native texture is created against, and a parent for the sink — and
 * nothing in React Native's tree hands one sideways. The scene navigator is a
 * sibling of this module's view, not an ancestor, so the search starts at the
 * window's root.
 *
 * EVERY LIVE ACTIVITY, NOT THE "CURRENT" ONE. Measured on a PICO 4 Ultra: the
 * immersive scene runs in `VRActivity` — a second React root in a NEW_TASK,
 * resumed while `MainActivity` stays paused behind it. `currentActivity`
 * through the Expo `AppContext` is the host's view of the foreground, which
 * races the cross-activity onHostResume/onPause ordering the VRActivity
 * comments describe — under a headset it can answer `MainActivity` (or null)
 * for the whole session, and a walk from it answers `no-viro-view` forever.
 * The application already knows every live activity; tracking them here
 * removes the assumption entirely — the renderer's window is found wherever
 * it lives.
 *
 * THE CEILING IS ONE RENDERER PER PROCESS, and it holds here because the
 * spatial route mounts exactly one navigator. Two would make this a coin
 * toss, and the fix then is a `navigatorTag` prop plus
 * `VRT3DSceneNavigator.getViroView()` — the same view-tag resolution
 * `ViroSplatPassModule` uses — not a cleverer walk.
 * SOT: apps/mobile/modules/board-texture/README.md
 * SOT-KEYWORDS: viro view finder window root walk renderer android view texture activity tracker
 */

private val liveActivities = CopyOnWriteArraySet<WeakReference<Activity>>()
private var trackingRegistered = false

/** Every activity the process has live, so a second window can be searched. */
private fun trackActivities(context: Context) {
  if (trackingRegistered) return
  trackingRegistered = true
  (context.applicationContext as? Application)?.registerActivityLifecycleCallbacks(
    object : Application.ActivityLifecycleCallbacks {
      private fun remember(activity: Activity) {
        liveActivities.removeIf { it.get() == null }
        if (liveActivities.none { it.get() === activity }) liveActivities.add(WeakReference(activity))
      }
      override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) = remember(activity)
      override fun onActivityStarted(activity: Activity) = remember(activity)
      override fun onActivityResumed(activity: Activity) = remember(activity)
      override fun onActivityDestroyed(activity: Activity) {
        liveActivities.removeIf { it.get() === activity || it.get() == null }
      }
      override fun onActivityPaused(activity: Activity) {}
      override fun onActivityStopped(activity: Activity) {}
      override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
    },
  )
}

internal fun View.findViroView(activity: Activity?): ViroView? {
  trackActivities(context)
  rootView.firstViroView()?.let { return it }
  activity?.window?.decorView?.firstViroView()?.let { return it }
  for (ref in liveActivities) {
    val decorView = ref.get()?.window?.decorView ?: continue
    decorView.firstViroView()?.let { return it }
  }
  return null
}

private fun View.firstViroView(): ViroView? {
  if (this is ViroView) {
    return this
  }
  if (this !is ViewGroup) {
    return null
  }
  for (index in 0 until childCount) {
    val found = getChildAt(index).firstViroView()
    if (found != null) {
      return found
    }
  }
  return null
}
