package com.moyolearn.boardtexture

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
 * THE CEILING IS ONE RENDERER PER WINDOW, and it holds here because the spatial
 * route mounts exactly one navigator. Two would make this a coin toss, and the
 * fix then is a `navigatorTag` prop plus `VRT3DSceneNavigator.getViroView()` —
 * the same view-tag resolution `ViroSplatPassModule` uses — not a cleverer walk.
 * SOT: apps/mobile/modules/board-texture/README.md
 * SOT-KEYWORDS: viro view finder window root walk renderer android view texture
 */
internal fun View.findViroView(): ViroView? = rootView.firstViroView()

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
