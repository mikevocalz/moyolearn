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
// `props.size` resolves through the vendor's own exported `SIZES` map, and
// `props.color` names a material generated from the vendor's light theme in
// `spatial-materials` — so spatial ink is the same colour and weight as 2D ink
// by construction rather than by a table copied into this repo.
// SOT: packages/ui/xr/spatial-tokens.ts · node_modules/@quickdrawjs/core/types/index.d.ts
// SOT-KEYWORDS: xr board ink polyline viro stroke record quickdraw page space surface metres renderer

import { ViroPolyline } from '@reactvision/react-viro';
import { inkMaterial } from './spatial-materials.native.ts';
import { strokeOf, type StrokeGeometry } from './stroke-of.ts';
import { boardSurfacePixels } from './spatial-tokens.ts';

export interface XrBoardInkProps {
  /** The document's store, as `snapshot().document.store`. */
  store: Readonly<Record<string, unknown>>;
  /** The paper's size in metres. Page pixels are mapped onto this. */
  width: number;
  height: number;
}

/**
 * PAGE PIXELS TO SURFACE METRES, once.
 *
 * The engine's camera is pinned at its default (see the `init` note in
 * `whiteboard-board.native.tsx`), so page space and the engine's client space
 * are the same space, and `boardSurfacePixels` is the rectangle of it the paper
 * shows. That is what makes an injected pointer at `(u·W, v·H)` and a stroke
 * drawn at the resulting page coordinate land in the same place.
 *
 * The two scales are equal by construction — `boardSurfacePixels` is 5:7 — so
 * this is a uniform scale and a child's handwriting can never be stretched.
 */
function pageToSurface(x: number, y: number, width: number, height: number): [number, number, number] {
  return [
    (x / boardSurfacePixels.width - 0.5) * width,
    (0.5 - y / boardSurfacePixels.height) * height,
    /* A hair in front of the paper, so the ink is never coplanar with it. */
    0.001,
  ];
}

export function XrBoardInk({ store, width, height }: XrBoardInkProps) {
  const strokes: StrokeGeometry[] = [];
  for (const [id, record] of Object.entries(store)) {
    const stroke = strokeOf(id, record);
    if (stroke !== null) strokes.push(stroke);
  }

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

            `highlight` is drawn at the engine's own width with reduced opacity
            rather than as a wide translucent quad: a highlighter that is a
            different primitive is a highlighter that stops matching the 2D
            board the moment either changes.
          */
          thickness={(stroke.width / boardSurfacePixels.width) * width}
          opacity={stroke.highlight ? 0.4 : 1}
          materials={[inkMaterial(stroke.colourId)]}
        />
      ))}
    </>
  );
}
