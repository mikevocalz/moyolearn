'use client';
// The whiteboard itself, live, on the spatial paper — the page, not a picture
// of it.
//
// WHAT CHANGED, AGAINST THE SENTENCE THIS FILE'S NEIGHBOURS REPEAT. "ViroReact
// cannot host a React Native view in a scene" is true of ViroReact's component
// set and false of the renderer under it: `com.viro.core.AndroidViewTexture`
// takes an Android `View`, parents it into a sink inside the `ViroView`,
// redirects that sink's draw into a texture, and hands the texture out as a
// `Texture` a material can carry. It ships in the vendored fork and nothing in
// `react_viro` exposed it. `apps/mobile/modules/board-texture` is that
// exposure; this quad is what the texture lands on.
//
// So the paper shows the page: the same WebView the 2D pane runs, at the same
// moment, with text, notes, arrows and images the polyline renderer has no
// primitive for — and with the child's own stroke arriving as they draw it
// rather than a settle window later.
//
// WHAT IT REPLACES WHEN IT BINDS. `XrBoardRaster` and `XrBoardInk`, both of
// them, and only when the binding actually succeeded (`onBound`). Every way the
// binding can fail keeps that pair, because a scene that showed a blank quad
// instead of a child's homework would be worse than a picture of it.
//
// WHAT IS STILL THE POINTER QUAD'S. Input does not come through this surface —
// `XrPanel` catches the ray one layer in front and the screen injects
// synthesised `PointerEvent`s into the page. The sink CAN convert a Viro click
// into a `MotionEvent` (`getClickListenerWithQuad`), and it is deliberately not
// used: it is click-down/up only, so a stroke drawn with it would be two points
// and a straight line between them.
// SOT: apps/mobile/modules/board-texture/README.md · packages/ui/xr/BoardTextureHost.native.tsx
// SOT-KEYWORDS: xr board live texture viro quad android view texture whiteboard inside scene

import { ViroQuad } from '@reactvision/react-viro';
/* From the module that REGISTERS the materials rather than the one that only
   names them — the same reason every other surface here imports it this way.
   Kotlin fills this material's diffuse channel by name, and a name that was
   never registered is a bind that fails for no visible reason. */
import { XR_MATERIAL } from './spatial-materials.native.ts';
import { boardLayer } from './spatial-tokens.ts';
import type { XrBoardLiveProps } from './XrBoardLive.types.ts';

export function XrBoardLive({ width, height }: XrBoardLiveProps) {
  return (
    <ViroQuad
      width={width}
      height={height}
      /*
        The raster's own layer, because it is the raster's own job: in front of
        the paper, behind the pointer quad at `POINTER_STANDOFF`. `boardLayer.ink`
        is left empty here — there is no second layer to reconcile when the page
        itself is what is drawn.
      */
      position={[0, 0, boardLayer.raster]}
      materials={[XR_MATERIAL.boardLive]}
      /*
        The ray must reach the pointer quad in front of this one. A board that
        handled its own events would eat the drag that draws on it.
      */
      ignoreEventHandling
    />
  );
}
