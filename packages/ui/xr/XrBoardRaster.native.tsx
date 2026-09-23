'use client';
// The whiteboard itself, on the spatial paper.
//
// WHY THIS EXISTS, WHEN `XrBoardInk` ALREADY DRAWS STROKES. It draws strokes and
// only strokes: `strokeOf` answers `null` for text, notes, arrows and images,
// and a child who typed a note on a laptop and put a headset on found it gone.
// The count of what was missing went to the companion panel, which is honest
// and is not the same as showing the child their work.
//
// ViroReact still cannot host a React Native view in a scene — that has not
// changed and is not what this is. The engine rasters the document it already
// owns (`WhiteboardHandle.exportPng`) and the picture is textured onto the
// paper as a `ViroImage`. One document, one renderer of record, and the spatial
// paper shows exactly what the 2D pane shows rather than a subset of it.
//
// WHAT IT DOES NOT DO, AND MUST NOT. It is not the live surface. A raster is
// taken when the document settles, so the stroke still under a child's hand is
// not in it — `XrBoardInk` draws those, in front, at `boardLayer.ink`. A raster
// that tried to keep up with a pointer would be a picture arriving a third of a
// second after the hand that drew it, which reads as a board that is broken.
//
// THE SEAM, NAMED. Between a change and the next raster the picture is stale by
// one settle window: an erased mark is still in it, and a mark drawn after the
// raster was requested may be in BOTH it and the live layer. Ink drawn twice at
// the same place in the same colour is invisible; ink missing is not, so the
// overlap is the direction this is deliberately wrong in.
// SOT: packages/ui/xr/raster-coverage.ts · packages/app/features/tutor/board-raster.native.ts
// SOT-KEYWORDS: xr board raster viro image png data url paper texture whiteboard inside panel

import { ViroImage } from '@reactvision/react-viro';
import { boardLayer } from './spatial-tokens.ts';
import type { XrBoardRasterProps } from './XrBoardRaster.types.ts';

export function XrBoardRaster({ uri, width, height }: XrBoardRasterProps) {
  if (uri === null) return null;
  return (
    <ViroImage
      /*
        NOT KEYED ON THE PICTURE, deliberately. A new key is a new node, and a
        new node is one frame of blank paper between two rasters — a flicker
        under the child's own writing. `source` is a normal prop diff and the
        renderer re-resolves it. If a device ever shows the previous texture
        after a settle, a `key` is the fix; it is not the default.
      */
      source={{ uri }}
      width={width}
      height={height}
      /*
        Behind the live ink and in front of the paper — the order is the whole
        behaviour and it is stated once, in `boardLayer`.
      */
      position={[0, 0, boardLayer.raster]}
      /*
        `StretchToFill` is the honest mode HERE and nowhere else: the picture is
        16:8 because the engine's client space is 16:8 (`boardSurfacePixels`) and
        the paper is 16:8 because `BOARD_ASPECT` says so. Fitting would letterbox
        a picture that already matches, and filling would crop a child's margin.
      */
      resizeMode="StretchToFill"
      imageClipMode="ClipToBounds"
      /*
        No mipmaps. The board is looked at from roughly one distance and never
        at a glancing angle, so the chain buys nothing and costs a third again
        of the texture memory on every settle — on a headset, per raster.
      */
      mipmap={false}
    />
  );
}
