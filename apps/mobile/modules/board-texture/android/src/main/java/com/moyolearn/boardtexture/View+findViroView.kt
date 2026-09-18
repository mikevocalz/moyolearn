package com.moyolearn.boardtexture

import android.app.Activity
import android.view.View
import android.view.ViewGroup
import com.viro.core.ViroView

/**
 * The renderer's own view, found from anywhere in the same window.
 *
 * `AndroidViewTexture` needs a `ViroView` for two things — the `ViroContext`
 * the native texture is created against, and a parent for the sink — and
 * nothing in React Native's tree hands one sideways. The scene navigator is a
 * sibling of this module's view, not an ancestor, so the search starts at the
 * window's root.
 *
 * TWO WINDOWS, BECAUSE A HEADSET USES TWO. Measured on a PICO 4 Ultra: the
 * immersive scene runs in `VRActivity` with its own React root
 * (`Running "VRQuestScene"` in the Metro log), while the screen's 2D tree —
 * this view, and the page it holds — stays in `MainActivity`. A walk from
 * `rootView` alone therefore searches the wrong window and answers
 * `no-viro-view` on exactly the hardware the live board exists for. The current
 * activity is the second place to look, and on a headset it is the first that
 * finds anything.
 *
 * THE CEILING IS ONE RENDERER PER WINDOW, and it holds here because the spatial
 * route mounts exactly one navigator. Two would make this a coin toss, and the
 * fix then is a `navigatorTag` prop plus `VRT3DSceneNavigator.getViroView()` —
 * the same view-tag resolution `ViroSplatPassModule` uses — not a cleverer walk.
 * SOT: apps/mobile/modules/board-texture/README.md
 * SOT-KEYWORDS: viro view finder window root walk renderer android view texture
 */
internal fun View.findViroView(activity: Activity?): ViroView? =
  rootView.firstViroView() ?: activity?.window?.decorView?.firstViroView()

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
