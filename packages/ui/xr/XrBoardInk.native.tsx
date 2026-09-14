'use client';
// The child's strokes, drawn onto the spatial paper.
//
// WHAT THIS IS AND IS NOT. It is not a drawing engine and it holds no state:
// Quickdraw remains the only thing that decides what a stroke is, how the
// eraser behaves, and what a diff means. This reads the document those
// decisions produce and emits one `ViroPolyline` per stroke record. One
// document, two presentations — the 2D pane renders it with the engine's own
// canvas, the headset renders it with ViroCore.
//
// THE RECORD SHAPE IS VENDOR-INTERNAL AND READ DEFENSIVELY. `ShapeRecord.props`
// is typed `Record<string, any>` in `@quickdrawjs/core`, so the geometry's
// layout is not part of the package's contract. What the installed engine
// actually writes for a freehand stroke (`board-html.generated.js`) is
// `props: { pts: [[dx, dy, pressure], …], color, size, dash }` with `x`/`y` on
// the record as the stroke's origin. Every field is therefore checked before
// use and a record that does not match is skipped rather than guessed at — a
// vendor bump can change this and the failure must be a missing stroke in a
// review, not a crash in a child's session.
//
// `props.color` names a material generated from the vendor's light theme in
// `spatial-materials`, and `props.size`/`props.dash` resolve to a page-space
// width and an opacity in `stroke-of` through the engine's own four constants —
// so spatial ink is the same colour and weight as 2D ink by construction rather
// than by a table copied into this repo.
//
// WHAT IT CANNOT DRAW, IT COUNTS. `strokeOf` answers `null` for text, notes,
// arrows and images, which the web app's fuller tray can produce and this
// renderer has no primitive for. Dropping them silently made the board look
// complete when it was not, so the count goes back up to the caller and the
// companion panel says it (`04-copy.md` §5.2).
//
// THE COUNT IS NOW A MOMENT, NOT A VERDICT, and that is what changed under it:
// the caller hands this only the records `XrBoardRaster`'s picture does not
// already show, so a typed note is missing for one settle window instead of for
// the whole session. Everything the engine can draw reaches the paper through
// the raster; this layer is the strokes that arrived after it was asked for.
// SOT: packages/ui/xr/stroke-of.ts · packages/ui/xr/spatial-tokens.ts
// SOT-KEYWORDS: xr board ink polyline viro stroke record quickdraw page space surface metres renderer skipped

import { useEffect, useMemo } from 'react';
import { ViroPolyline } from '@reactvision/react-viro';
import { inkMaterial } from './spatial-materials.native.ts';
import { strokeOf, type StrokeGeometry } from './stroke-of.ts';
import { boardLayer, boardSurfacePixels } from './spatial-tokens.ts';
/* Props live outside this file so the web fork can name them without naming
   Viro — the `XrPanel.types.ts` arrangement, for the same reason. */
import type { XrBoardInkProps } from './XrBoardInk.types.ts';

/**
 * PAGE PIXELS TO SURFACE METRES, once.
 *
 * The engine's camera is pinned at its default (see the `init` note in
 * `whiteboard-board.native.tsx`), so page space and the engine's client space
 * are the same space, and `boardSurfacePixels` is the rectangle of it the paper
 * shows. That is what makes an injected pointer at `(u·W, v·H)` and a stroke
 * drawn at the resulting page coordinate land in the same place.
 *
 * The two scales are equal by construction — `boardSurfacePixels` is 6:4 — so
 * this is a uniform scale and a child's handwriting can never be stretched.
 */
function pageToSurface(x: number, y: number, width: number, height: number): [number, number, number] {
  return [
    (x / boardSurfacePixels.width - 0.5) * width,
    (0.5 - y / boardSurfacePixels.height) * height,
    /* In front of the raster, which is in front of the paper. The order is
       stated once, in `boardLayer` — a stroke a child is still drawing must
       never be hidden by a picture of the board taken before they drew it. */
    boardLayer.ink,
  ];
}

export function XrBoardInk({ store, width, height, onSkippedCount }: XrBoardInkProps) {
  /*
    Counted in the same pass that draws, because the two answers have to come
    from one reading of the document — a second walk is a second chance for the
    count and the paper to disagree about the same board.

    `skipped` is every record this renderer had no primitive for. Asset records
    are included: an image a child placed on the web app is missing from the
    spatial paper exactly as a typed note is, and the child cannot tell the two
    absences apart either.
  */
  const { strokes, skipped } = useMemo(() => {
    const drawn: StrokeGeometry[] = [];
    let missed = 0;
    for (const [id, record] of Object.entries(store)) {
      const stroke = strokeOf(id, record);
      if (stroke === null) missed += 1;
      else drawn.push(stroke);
    }
    return { strokes: drawn, skipped: missed };
  }, [store]);

  /*
    Reported from an effect rather than during the render that computed it: the
    caller's handler writes to a store, and a store write inside a render is a
    second render of whatever else subscribes to it, mid-commit.
  */
  useEffect(() => {
    onSkippedCount(skipped);
  }, [onSkippedCount, skipped]);

  return (
    <>
      {strokes.map((stroke) => (
        <ViroPolyline
          key={stroke.id}
          points={stroke.points.map((point) => pageToSurface(point.x, point.y, width, height))}
          /*
            Thickness in metres, from the vendor's page-space width through the
            same scale the points take — so a stroke is as thick relative to the
            paper as it is in 2D rather than a fixed spatial width that looks
            like a marker on a small board and a hair on a large one.

            `highlight` is a WIDE band and not a thin line at reduced opacity.
            The engine strokes it at `SIZES[size] × HIGHLIGHT_SCALE` with
            `globalAlpha = HIGHLIGHT_ALPHA`, and this drew it at `SIZES[size]`
            with 0.4 — a quarter of the width, at an alpha nobody had taken from
            the vendor. Both numbers now come from `stroke-of` with the rest of
            the engine's constants, so the band is the same mark in both
            presentations rather than two guesses that happen to be close.
          */
          thickness={(stroke.width / boardSurfacePixels.width) * width}
          opacity={stroke.opacity}
          materials={[inkMaterial(stroke.colourId)]}
        />
      ))}
    </>
  );
}
