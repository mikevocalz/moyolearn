package com.moyolearn.boardtexture

import android.view.View
import android.webkit.WebView
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * `MoyoBoardTexture` — one view, Android only.
 *
 * There is no JavaScript entry point in this module on purpose: the view is
 * reached with `requireNativeView('MoyoBoardTexture')` from
 * `packages/ui/xr/BoardTextureHost.native.tsx`, which is where the rest of the
 * spatial board lives. A second copy of the wrapper inside `apps/mobile` would
 * be a second place to keep the prop names right.
 * SOT: packages/ui/xr/BoardTextureHost.native.tsx · apps/mobile/modules/board-texture/README.md
 * SOT-KEYWORDS: board texture expo module view definition props live material page size bind
 */
class BoardTextureModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MoyoBoardTexture")

    /*
      `Surface.lockCanvas` hands the sink a SOFTWARE canvas, and a hardware-
      composited Chromium WebView draws black into one unless the whole
      document has been switched to slow software rasterization first. This
      call is process-wide and legal only before the first WebView exists —
      module creation runs before the page child mounts, which is the last
      seam where that is still true. If another WebView beat us to it the
      call throws; the board then stays a black texture rather than crashing
      the module registry.
    */
    OnCreate {
      try {
        WebView.enableSlowWholeDocumentDraw()
      } catch (ignored: Throwable) {
      }
    }

    View(BoardTextureHostView::class) {
      Events("onBound")

      Prop("material") { view: BoardTextureHostView, name: String ->
        view.setMaterial(name)
      }

      /*
        The page's CSS size in dp — `boardSurfacePixels`, the same constant the
        pointer injection scales by. Passed as two numbers rather than a record
        because that is all it is, and a record would be a type to keep in step
        on both sides of the bridge.
      */
      Prop("pageWidth") { view: BoardTextureHostView, width: Double ->
        view.setPageWidth(width)
      }
      Prop("pageHeight") { view: BoardTextureHostView, height: Double ->
        view.setPageHeight(height)
      }

      /*
        Asking to bind is the SCENE's move, not this view's: the renderer exists
        only once the navigator is mounted, and nothing in the view hierarchy
        announces that. `live` is the caller saying the scene is up.
      */
      Prop("live") { view: BoardTextureHostView, live: Boolean ->
        view.setLive(live)
      }

      OnViewDestroys { view: BoardTextureHostView ->
        view.release()
      }

      GroupView<BoardTextureHostView> {
        AddChildView { parent: BoardTextureHostView, child: View, index: Int ->
          parent.addPage(child, index)
        }
        GetChildCount { view: BoardTextureHostView -> view.pageCount() }
        GetChildViewAt { view: BoardTextureHostView, index: Int -> view.pageAt(index) }
        RemoveChildViewAt { view: BoardTextureHostView, index: Int -> view.removePageAt(index) }
      }
    }
  }
}
