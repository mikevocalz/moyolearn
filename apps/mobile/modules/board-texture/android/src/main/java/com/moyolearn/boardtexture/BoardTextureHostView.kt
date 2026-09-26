package com.moyolearn.boardtexture

import android.content.Context
import android.view.View
import com.facebook.react.bridge.ReactContext
import com.facebook.react.uimanager.PixelUtil
import com.viro.core.AndroidViewTexture
import com.viromedia.bridge.module.MaterialManager
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

/**
 * The place the whiteboard's page is mounted in the React tree, and the place it
 * is taken out of it.
 *
 * The page — one `react-native-webview` running Quickdraw — is this view's only
 * child while it belongs to React Native, which is what loads it, lays it out
 * and keeps it attached to a window. [bind] then hands that same `View` to
 * `AndroidViewTexture`, which parents it into a sink inside the `ViroView` and
 * redirects the sink's draw into a texture surface. The child does not change,
 * does not reload and does not lose the stroke in progress; only its parent
 * does.
 *
 * THE CHILD LEAVES THIS VIEWGROUP, SO REACT NATIVE'S BOOKKEEPING CANNOT COME
 * FROM IT. `pages` is the list React Native believes in, and the module's
 * `GroupView` block answers every child question from that list rather than from
 * `ViewGroup`'s own children — the pattern React Native's own modal host uses
 * for the same reason. Answer `getChildCount` from `ViewGroup` after the hand-off
 * and the renderer is told the tree it just built is empty.
 * SOT: apps/mobile/modules/board-texture/README.md · packages/ui/xr/BoardTextureHost.native.tsx
 * SOT-KEYWORDS: board texture host view android view texture sink webview reparent expo group view
 */
class BoardTextureHostView(context: Context, appContext: AppContext) :
  ExpoView(context, appContext) {

  private val onBound by EventDispatcher<BoardTextureBinding>()

  /** React Native's children, in React Native's order, wherever they are parented. */
  private val pages = mutableListOf<View>()

  private var texture: AndroidViewTexture? = null
  private var materialName: String? = null
  private var pageWidthDp = 0.0
  private var pageHeightDp = 0.0
  private var live = false

  /**
   * Whether an attempt with every input present has already been made and
   * answered. A bind is one shot per mounted scene: a failure means the scene
   * keeps the raster presentation, and retrying on the next prop would report a
   * second answer for a decision the scene has already acted on.
   */
  private var settled = false
  private var attempts = 0
  private val retryBind = Runnable { bindIfReady() }

  // ---------------------------------------------------------------------------
  // Props
  // ---------------------------------------------------------------------------

  fun setMaterial(name: String) {
    materialName = name
    bindIfReady()
  }

  fun setPageWidth(dp: Double) {
    pageWidthDp = dp
    bindIfReady()
  }

  fun setPageHeight(dp: Double) {
    pageHeightDp = dp
    bindIfReady()
  }

  fun setLive(value: Boolean) {
    if (live == value) return
    live = value
    if (!value) {
      release()
      onBound(BoardTextureBinding(bound = false, reason = "surface-detached"))
    } else {
      attempts = 0
      settled = false
      bindIfReady()
    }
  }

  // ---------------------------------------------------------------------------
  // The page
  // ---------------------------------------------------------------------------

  fun addPage(child: View, index: Int) {
    pages.add(index, child)
    val boundTexture = texture
    if (boundTexture == null) {
      addView(child, index)
      bindIfReady()
      return
    }
    /*
      Bound already: the page goes straight to the sink. Only the first child is
      ever textured — the sink renders one page and a second one would be drawn
      on top of it at the same size, which is a caller error rather than a
      layout to support.
    */
    if (index == 0) boundTexture.attachView(child) else addView(child)
  }

  fun pageCount(): Int = pages.size

  fun pageAt(index: Int): View? = pages.getOrNull(index)

  fun removePageAt(index: Int) {
    val child = pages.removeAt(index)
    if (child.parent === this) {
      removeView(child)
      return
    }
    texture?.detachView()
  }

  // ---------------------------------------------------------------------------
  // Binding
  // ---------------------------------------------------------------------------

  private fun bindIfReady() {
    if (settled || !live || !isAttachedToWindow || pages.isEmpty()) {
      return
    }
    val material = materialName ?: return
    if (pageWidthDp <= 0.0 || pageHeightDp <= 0.0) {
      return
    }

    removeCallbacks(retryBind)
    val reason = bind(material)
    // Viro creates its Activity and registers materials asynchronously. These
    // are transient readiness failures, not proof the bridge is unavailable.
    if (reason in setOf("no-viro-view", "no-material-manager", "material-not-registered") && ++attempts < 30) {
      postDelayed(retryBind, 150L)
      return
    }
    settled = true
    onBound(BoardTextureBinding(bound = reason == null, reason = reason))
  }

  /** Returns null when the board is on the material, else why it is not. */
  private fun bind(material: String): String? {
    val viroView = findViroView(appContext.currentActivity) ?: return "no-viro-view"
    /*
      `appContext.reactContext` is typed as a plain Android `Context` and IS the
      React one at runtime; the cast is where that stops being an assumption.
      `MaterialManager` is where `ViroMaterials.createMaterials` puts what
      JavaScript registered, and it is the only way to reach a material by the
      name a quad draws with.
    */
    val materials = (appContext.reactContext as? ReactContext)
      ?.getNativeModule(MaterialManager::class.java)
      ?: return "no-material-manager"
    val target = materials.getMaterial(material) ?: return "material-not-registered"

    /*
      PIXELS, FROM THE PAGE'S OWN dp. The sink measures its child at exactly the
      texture's pixel size, and a WebView's CSS pixel is a dp — so a texture
      sized in raw page units would render the page at 1/density of the size
      every other consumer of `boardSurfacePixels` assumes, and the injected
      pointer would land at a fraction of where the ray is.

      THE CEILING, because it is a real one: this is a SOFTWARE canvas
      (`AndroidViewSink.dispatchDraw` locks one), so the cost of a frame is
      `pageSize × density` pixels of CPU draw. If that is too slow on device,
      lower `boardSurfacePixels` — it is the page's CSS size, and the host box,
      the pointer scale and the ink mapping all read it, so they move together.
    */
    val pxWidth = PixelUtil.toPixelFromDIP(pageWidthDp).toInt()
    val pxHeight = PixelUtil.toPixelFromDIP(pageHeightDp).toInt()
    if (pxWidth <= 0 || pxHeight <= 0) {
      return "empty-page"
    }

    /*
      Hardware acceleration asked for, and it buys exactly one thing: size. A
      software layer is capped by the view system's drawing cache
      (`AndroidViewTexture.supportsSoftwareSurfaceOfSize`), which on a headset
      panel is smaller than a page this big. Viro's own warning about hardware
      mode is about its INPUT path, and nothing here uses it — the child's
      pointer arrives as synthesised `PointerEvent`s inside the page, not as a
      `MotionEvent` through the sink.
    */
    val created = try {
      AndroidViewTexture(viroView, pxWidth, pxHeight, true)
    } catch (error: Throwable) {
      return "texture-failed: ${error.message}"
    }

    target.setDiffuseTexture(created)
    texture = created

    val page = pages.firstOrNull() ?: return null
    /*
      The sink draws children into a SOFTWARE canvas (`Surface.lockCanvas`)
      no matter which texture mode was asked for. A WebView that stays
      hardware-rendered draws black into that canvas on this OS — its content
      is composited by Chromium, not drawn through `View.draw`. A software
      layer on the page forces software rasterization of the whole subtree,
      which is the documented path for getting real WebView pixels into a
      canvas. Reverted on release so the parked board keeps hardware accel.
    */
    page.setLayerType(View.LAYER_TYPE_SOFTWARE, null)
    if (page.parent === this) {
      removeView(page)
    }
    created.attachView(page)
    return null
  }

  /**
   * Gives the page back to React Native before React Native asks for it.
   *
   * The sink belongs to the `ViroView` and goes when the navigator does, but the
   * page is React Native's view: left inside a detached sink, the next thing the
   * renderer does with it operates on a child of a parent that no longer draws.
   */
  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    bindIfReady()
  }

  override fun onDetachedFromWindow() {
    release()
    onBound(BoardTextureBinding(bound = false, reason = "surface-detached"))
    super.onDetachedFromWindow()
  }

  fun release() {
    removeCallbacks(retryBind)
    settled = false
    attempts = 0
    val page = pages.firstOrNull()
    texture?.detachView()
    texture?.dispose()
    texture = null
    if (page != null && page.parent == null) {
      page.setLayerType(View.LAYER_TYPE_NONE, null)
      addView(page)
    }
  }
}
