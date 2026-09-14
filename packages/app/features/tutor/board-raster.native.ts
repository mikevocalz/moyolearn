'use client';
// When the engine is asked for a picture of the board, and what that picture is
// known to contain.
//
// WHY THE SCENE NEEDS ONE AT ALL. `XrBoardInk` renders stroke records as
// polylines and has no primitive for text, notes, arrows or images — so a child
// who typed a note on a laptop and then put a headset on saw a board with a
// hole in it. The engine can draw all of those, because it is the thing that
// drew them; it just cannot be MOUNTED in a Viro scene. So it is asked for a
// raster instead and `XrBoardRaster` textures the paper with it.
//
// WHEN. On settle, never on stroke. `exportPng` crosses the WebView bridge and
// comes back as base64 — hundreds of kilobytes — so it is debounced, and a
// request is not even scheduled while a stroke is open: the live polylines are
// what a child watches their own handwriting appear in, and a raster taken
// mid-stroke would be thrown away by the next one a moment later.
//
// AT 1×, NOT THE TUTOR PATH'S 2×. That scale exists for an OCR pass; this
// picture is for an eye, at 1.5 m, on a 6:4 surface. Two would quadruple the
// bytes on the bridge for pixels the headset cannot resolve.
//
// WHAT IT PROMISES THE INK LAYER. `covered` is the set of record ids the
// document held WHEN THE PICTURE WAS ASKED FOR. The engine may raster a mark or
// two more before it answers, so the guarantee is one-sided: everything in
// `covered` is certainly in the picture, and something outside it might also
// be. `uncoveredRecords` turns that into the live layer, and the overlap is ink
// drawn twice in the same place rather than ink drawn nowhere.
// SOT: packages/ui/xr/raster-coverage.ts · packages/ui/xr/XrBoardRaster.native.tsx
// SOT-KEYWORDS: board raster hook export png debounce settle coverage spatial paper whiteboard

import { useEffect, useRef, useState } from 'react';
import type { WhiteboardHandle } from '@acme/ui';

/**
 * How long the document must sit still before its picture is worth taking.
 *
 * Longer than the board's local save window (400 ms) would leave the paper
 * visibly behind a child who stops to think; shorter turns a sentence of
 * handwriting into one export per word. 500 ms is a pause, not a pen-lift —
 * the gap between strokes inside a word is tens of milliseconds.
 */
const SETTLE_MS = 500;

/** For an eye at the board's distance, not for a recogniser. */
const RASTER_SCALE = 1;

export interface BoardRaster {
  /** The engine's PNG as a data URL, or `null` until the first one arrives. */
  uri: string | null;
  /** The record ids that picture is known to contain. */
  covered: ReadonlySet<string> | null;
}

const EMPTY: BoardRaster = { uri: null, covered: null };

/**
 * A picture of the document, refreshed whenever it settles.
 *
 * THE SIGNAL IS `store`'S IDENTITY, not a counter. The document mutates in
 * place, so the scene already memoises the snapshot on its `revision` — which
 * makes a new `store` object exactly "the document moved", and one dependency
 * instead of two that can disagree.
 *
 * `enabled` is false whenever a raster would be wrong to take or wrong to show:
 * no engine, or a board that is not currently accepting ink. A stale picture
 * under an interrupted board is still the child's work and stays on the paper —
 * it is only the REFRESH that stops.
 */
export function useBoardRaster(
  engine: () => WhiteboardHandle | null,
  store: Readonly<Record<string, unknown>>,
  enabled: boolean,
  strokeOpen: () => boolean,
): BoardRaster {
  const [raster, setRaster] = useState<BoardRaster>(EMPTY);
  /* Whether an export is in the air. Two overlapping exports would race to set
     the paper and the loser might be the newer picture. */
  const busy = useRef(false);
  /* Whether the document moved while one was in the air. */
  const stale = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const take = () => {
      const handle = engine();
      if (handle === null) return;
      /*
        NOT WHILE THE CHILD IS DRAWING. Re-armed rather than dropped: the stroke
        ends, the document settles, and the picture is taken then.
      */
      if (strokeOpen()) {
        stale.current = true;
        return;
      }
      if (busy.current) {
        stale.current = true;
        return;
      }
      busy.current = true;
      /* Captured BEFORE the await — this is the half of the promise that is
         actually true. See the header. */
      const covered = new Set(Object.keys(store));
      void handle.exportPng({ scale: RASTER_SCALE }).then(
        (png) => {
          busy.current = false;
          /*
            `null` is an empty board, not a failure (`WhiteboardHandle`), and it
            has to CLEAR the paper rather than leave the last picture on it —
            otherwise Clear wipes the document and the child keeps looking at
            what they just erased.
          */
          if (!cancelled) setRaster({ uri: png, covered: png === null ? null : covered });
          if (stale.current) {
            stale.current = false;
            if (!cancelled) take();
          }
        },
        () => {
          /* A failed export leaves the previous picture up. The live layer is
             still drawing strokes over it, so the board is never blank because
             one raster did not come back. */
          busy.current = false;
        },
      );
    };

    const timer = setTimeout(take, SETTLE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, engine, store, strokeOpen]);

  return raster;
}
