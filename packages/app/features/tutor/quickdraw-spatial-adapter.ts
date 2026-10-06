'use client';
// The adapter `@viro-external/ui`'s QuickDrawSpatialSurface mounts against.
//
// THE `renderer: "esiku"` BRAND ON A TRANSPORT THAT IS NOT ESIKU-COMPILED YET.
// What the contract's brand asserts is the rendering SHAPE — QuickDraw owns the
// document and the adapter owns an external GPU render target a Viro material
// reads — and that is true here: `MoyoBoardTexture` re-parents the live editor
// view into `AndroidViewTexture`, the external target Kotlin fills
// `moyoBoardLive`'s diffuse channel from. The eskiuc-compiled math backend in
// `render-passes/native/eskiu` is a migration target for the scalar helpers it
// names; when it lands, this adapter's transport is already the boundary it
// binds behind. No WebView, canvas, screenshot or video fallback is introduced
// by this file — the surface is a live external render target, nothing else.
//
// POINTER COORDINATES ARRIVE NORMALISED. The surface that owns the world
// transform converts a world hit to `(u, v)` once; this adapter multiplies by
// the page's CSS size and stops. Transforming a second time here is the bug
// `handleSurfaceInput`'s comment exists to prevent.
//
// THE HANDLE IS A LATE READER. The surface mounts before the engine reports an
// editor — WebView load and attach are async — so every verb reads the engine
// at call time through the getter the screen gave the factory, never a
// captured handle.
// SOT: packages/app/features/tutor/tutor-xr-screen.native.tsx · board-session.ts
//      packages/ui/whiteboard.types.ts · packages/ui/xr/material-names.ts
// SOT-KEYWORDS: quickdraw spatial adapter external render target dispatch pointer muse stylus

import type {
  NativeQuickDrawSpatialAdapter,
  QuickDrawPointerPhase,
  QuickDrawSpatialPointer,
  QuickDrawSpatialSurfaceHandle,
} from '@viro-external/xr-contract';
import {
  boardSurfacePixels,
  SPATIAL_STYLUS_SOURCE,
  XR_MATERIAL,
  type XrSurfaceInput,
} from '@acme/ui/xr';
import type {
  WhiteboardHandle,
  WhiteboardInk,
  WhiteboardPointerSample,
  WhiteboardTool,
} from '@acme/ui';
import type { BoardSession } from './board-session.ts';

/**
 * The contract's pointer vocabulary onto the engine's. `enter` is a hover into
 * the surface and `exit` leaves mid-stroke; the engine has neither, so an
 * arrival is a move and a departure cancels the stroke it would otherwise
 * leave open.
 */
const ENGINE_PHASE: Record<
  QuickDrawPointerPhase,
  WhiteboardPointerSample['phase']
> = {
  enter: 'move',
  move: 'move',
  down: 'begin',
  up: 'end',
  cancel: 'cancel',
  exit: 'cancel',
};

/** The screen's `XrSurfaceInput` onto the contract's, once, in one place. */
const SURFACE_PHASE: Record<
  XrSurfaceInput['phase'],
  QuickDrawPointerPhase
> = {
  begin: 'down',
  move: 'move',
  end: 'up',
  cancel: 'cancel',
};

/**
 * The screen-facing half of the contract: a dispatch that needs no mounted
 * handle, because the raster presentation still drives the same engine while
 * no live surface exists. `dispatchSurface` is the one seam every spatial
 * pointer — controller ray, stylus, board quad — crosses.
 */
export interface MoyoQuickDrawAdapter extends NativeQuickDrawSpatialAdapter {
  dispatchSurface(sample: XrSurfaceInput): void;
}

export function createMoyoQuickDrawAdapter(
  engine: () => WhiteboardHandle | null,
  session: () => BoardSession | null,
): MoyoQuickDrawAdapter {
  const dispatch = (event: QuickDrawSpatialPointer): void => {
    engine()?.injectPointer({
      phase: ENGINE_PHASE[event.phase],
      x: event.uv[0] * boardSurfacePixels.width,
      y: event.uv[1] * boardSurfacePixels.height,
      pressure: event.pressure,
    });
  };

  return {
    renderer: 'esiku',

    mount: (): QuickDrawSpatialSurfaceHandle => ({
      materialName: XR_MATERIAL.boardLive,
      dispatchPointer: dispatch,
      setTool: (tool) => engine()?.setTool(tool as WhiteboardTool),
      /*
        The engine's one style channel is ink; the contract's `setStyle` is a
        key/value bag. Map the keys the screen means and drop the rest rather
        than guessing at a setter the engine does not have.
      */
      setStyle: (key, value) => {
        if (key === 'ink' || key === 'color' || key === 'colour') {
          engine()?.setInk(value as WhiteboardInk);
        }
      },
      undo: () => engine()?.undo(),
      redo: () => engine()?.redo(),
      clear: () => engine()?.clear(),
      /*
        The DOCUMENT's snapshot, not the engine's `getSnapshot` promise: the
        contract's getter is synchronous, and `session.doc` is the store of
        record this screen restores from.
      */
      getSnapshot: () => session()?.doc.snapshot() ?? null,
      loadSnapshot: (snapshot) => {
        engine()?.loadSnapshot(snapshot);
      },
      exportPng: () => engine()?.exportPng() ?? Promise.resolve(null),
      /* Engine and session outlive the surface — the screen owns both. */
      dispose: () => undefined,
    }),

    /*
      Nothing to release: mount allocates no resource. The handle's verbs are
      engine reads, and the texture the material names belongs to
      `BoardTextureHost`, which the screen unmounts on its own lifecycle.
    */
    unmount: () => undefined,

    dispatchSurface: (sample) =>
      dispatch({
        phase: SURFACE_PHASE[sample.phase],
        /*
          The stylus is the one source that is not a controller ray, and the
          contract wants the device kind — so the shared `SPATIAL_STYLUS_SOURCE`
          sentinel becomes 'hand' and everything else is the controller that
          raycast it.
        */
        source: sample.source === SPATIAL_STYLUS_SOURCE ? 'hand' : 'controller',
        uv: [sample.u, sample.v],
        timestamp: Date.now(),
        pressure: sample.pressure,
      }),
  };
}
