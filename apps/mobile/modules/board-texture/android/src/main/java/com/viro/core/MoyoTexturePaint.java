package com.viro.core;

import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.PorterDuff;
import android.view.Surface;
import android.view.View;

/**
 * Paints an attached page straight into an {@link AndroidViewTexture}'s
 * surface, without going through {@link AndroidViewSink}.
 *
 * The sink draws only when the window it lives in performs a normal Android
 * draw traversal, and on {@link ViroViewOpenXR} there is no SurfaceView — the
 * OpenXR compositor owns the display — so on a headset that traversal can be
 * starved entirely: the texture binds but never receives a frame, which is
 * exactly the black-board / blank-content state. Package `com.viro.core` is
 * deliberate: {@code getTextureRenderSurface} is package-private, so the pump
 * has to live beside it.
 * SOT: apps/mobile/modules/board-texture/.../BoardTextureHostView.kt
 */
public final class MoyoTexturePaint {
    private MoyoTexturePaint() {}

    /** Draws `page` into the texture surface. False until the renderer has
     *  handed the texture a surface to draw into. */
    public static boolean paint(AndroidViewTexture texture, View page) {
        Surface surface = texture.getTextureRenderSurface();
        if (surface == null) {
            return false;
        }
        int width = texture.getWidth();
        int height = texture.getHeight();
        if (width <= 0 || height <= 0) {
            return false;
        }
        /* The sink's onMeasure does this when the window traverses; when the
           window never traverses, the pump is the only layout the page gets. */
        if (page.getWidth() != width || page.getHeight() != height) {
            page.measure(
                View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY));
            page.layout(0, 0, width, height);
        }
        Canvas canvas;
        try {
            canvas = surface.lockCanvas(null);
        } catch (Throwable error) {
            return false;
        }
        if (canvas == null) {
            return false;
        }
        try {
            canvas.drawColor(Color.TRANSPARENT, PorterDuff.Mode.CLEAR);
            page.draw(canvas);
        } finally {
            surface.unlockCanvasAndPost(canvas);
        }
        return true;
    }
}
