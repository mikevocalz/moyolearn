'use client';
// The Round 2 native board: `QuickDrawNativeBoard` (viro-external ui) drawing
// through `useWhiteboardRenderer` (viro-external native-panels), behind the
// `nativeBoard` device-validation switch. Off, and whenever native-panels is
// not linked into the build, the screen renders exactly what it rendered
// before: the WebView board through `QuickDrawSpatialSurface`.
//
// THE WEBVIEW BOARD STAYS THE STORE OF RECORD. The native board has its own
// QuickDraw document (`createQuickDrawBoardSession`), and the screen MIRRORS
// every surface sample into it (`mirrorToNativeBoard`) after sending the same
// sample to the WebView engine. So with the switch on the child sees the native
// paper, while persistence, undo, tools and the Ask snapshot still run on the
// WebView document. That is enough to compare drawing, latency and image
// quality on a headset; moving the screen onto the session's store is the
// migration viro-external docs/guides/native-whiteboard.md describes, and it
// is not this change.
//
// THE PAPER'S MATERIAL. A `canvasSource` material keyed by a surface id from
// the high range native-panels' `allocateRiveSurfaceId` uses, so it never meets
// an id nitro-canvas hands out. Viro allocates the Surface and publishes it in
// its CanvasSurfaces registry; the native renderer draws into it. The paper is
// opaque white inside the board chrome's square window, so the material uses
// no corner radius and the default blend.
//
// Followed: viro-external packages/ui/doc/QuickDrawSpatialSurface.md "Native
// board" and docs/guides/native-whiteboard.md "Adopt"; the material shape from
// native-panels src/rive/mountNativeRivePanel.ts.
// SOT: device-validation-flags.ts · native-panels-linked.native.ts · tutor-xr-screen.native.tsx
// SOT-KEYWORDS: native board quickdraw native panels whiteboard renderer canvas source round 2 mirror

import { useEffect, useMemo, type ReactElement, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { ViroMaterials } from '@reactvision/react-viro';
import {
  QuickDrawNativeBoard,
  createHeadlessBoardSink,
  createQuickDrawBoardSession,
  type QuickDrawBoardSession,
  type UseBoardRenderer,
} from '@viro-external/ui';
import type { QuickDrawPointerEvent } from '@viro-external/xr-contract';
import { SPATIAL_STYLUS_SOURCE, boardSurfacePixels, type XrSurfaceInput } from '@acme/ui/xr';
import { deviceValidationFlags } from './device-validation-flags.ts';
import { nativePanelsLinked } from './native-panels-linked.native.ts';

/** Twice the WebView page, the size viro-external's guide renders the paper at. */
const SURFACE_WIDTH_PX = boardSurfacePixels.width * 2;
const SURFACE_HEIGHT_PX = boardSurfacePixels.height * 2;
/** Just below native-panels' Rive id range (from 0x4e500000) and far above nitro-canvas's small ids. */
const BOARD_SURFACE_ID = 0x4e4ff000;
const BOARD_MATERIAL = 'moyoNativeBoardPaper';

/**
 * Text width for the headless board's hit bounds. QuickDraw needs a measure;
 * the WebView board measures with the browser. This board only mirrors ink, so
 * a monospace estimate (the factor viro-external's own tests use) is enough.
 */
const measureTextWidth = (text: string, font: { fontSizePx: number }) => text.length * font.fontSizePx * 0.5;

let session: QuickDrawBoardSession | null = null;
let sink: ((event: QuickDrawPointerEvent) => void) | null = null;
let pointerSerial = 0;
let linked: boolean | null = null;

function boardSession(): QuickDrawBoardSession {
  if (session === null || session.isDisposed) {
    session = createQuickDrawBoardSession({
      measureTextWidth,
      boardWidth: boardSurfacePixels.width,
      boardHeight: boardSurfacePixels.height,
    });
    sink = createHeadlessBoardSink(session.board, session);
  }
  return session;
}

/*
  NATIVE-PANELS IS REQUIRED, NOT IMPORTED. Its sources are TypeScript written
  against viro 3.0.3-moyo.1, and this app has viro 3.0.1-moyo.1, so `tsc`
  reports 5 errors inside the package, all `ViroRivePanel` props the older viro
  does not declare (`cornerRadius`, `blendMode`, `bindings`). The Nitro errors
  are gone now that both sides run Nitro 1.0. A `require` keeps those sources
  out of this package's typecheck, types the one value used at the boundary,
  and evaluates the module only when the native board first mounts, which
  never happens with the switch off or the package unlinked. Replace it with an
  import in the change that moves the app to viro 3.0.3-moyo.1.
*/
let useRendererHook: UseBoardRenderer | null = null;
function whiteboardRenderer(): UseBoardRenderer {
  if (useRendererHook === null) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- kept out of the typecheck; see above
    const nativePanels = require('@viro-external/native-panels') as { useWhiteboardRenderer: UseBoardRenderer };
    useRendererHook = nativePanels.useWhiteboardRenderer;
  }
  return useRendererHook;
}

function rendererLinked(): boolean {
  if (linked === null) linked = nativePanelsLinked('nativepanels.WhiteboardRendererFactory');
  return linked;
}

/** True when the switch is on AND this build can create the native renderer. */
export function useNativeBoardEnabled(): boolean {
  const requested = useStore(deviceValidationFlags, (s) => s.nativeBoard);
  return requested && rendererLinked();
}

const PHASE: Record<XrSurfaceInput['phase'], QuickDrawPointerEvent['phase']> = {
  begin: 'down',
  move: 'move',
  end: 'up',
  cancel: 'cancel',
};

/**
 * Sends one surface sample to the native board's document. A no-op until the
 * native board has mounted once, so the switch being off costs one null check.
 */
export function mirrorToNativeBoard(sample: XrSurfaceInput): void {
  if (sink === null || session === null || session.isDisposed) return;
  if (sample.phase === 'begin') pointerSerial += 1;
  const event: QuickDrawPointerEvent = {
    phase: PHASE[sample.phase],
    pointerId: pointerSerial,
    source: sample.source === SPATIAL_STYLUS_SOURCE ? 'pen' : 'controller',
    uv: [sample.u, sample.v],
    timestampMs: performance.now(),
    ...(sample.pressure === undefined ? null : { pressure: sample.pressure }),
  };
  sink(event);
}

export interface NativeBoardPaperProps {
  width: number;
  height: number;
  position: [number, number, number];
  /** The WebView board, shown until the native renderer is ready and whenever it is unavailable or fails. */
  fallback: ReactNode;
}

/**
 * The native paper, or `fallback`. Render it only when `useNativeBoardEnabled()`
 * is true. Its own paper input is off (`interactive={false}`): the screen's
 * `XrBoardSurface` already catches every ray in front of it, and the samples
 * reach this board through `mirrorToNativeBoard`, so a second input path would
 * draw every stroke twice.
 */
export function NativeBoardPaper({ width, height, position, fallback }: NativeBoardPaperProps): ReactElement {
  const boardSessionForMount = useMemo(() => boardSession(), []);
  useEffect(() => {
    ViroMaterials.createMaterials({
      [BOARD_MATERIAL]: {
        diffuseTexture: { canvasSource: BOARD_SURFACE_ID, width: SURFACE_WIDTH_PX, height: SURFACE_HEIGHT_PX },
        diffuseColor: '#FFFFFF',
        lightingModel: 'Constant',
      },
    });
    return () => {
      ViroMaterials.deleteMaterials([BOARD_MATERIAL]);
    };
  }, []);
  return (
    <QuickDrawNativeBoard
      session={boardSessionForMount}
      nativeBoard
      useRenderer={whiteboardRenderer()}
      surface={{ surfaceId: BOARD_SURFACE_ID, materialName: BOARD_MATERIAL, widthPx: SURFACE_WIDTH_PX, heightPx: SURFACE_HEIGHT_PX }}
      widthM={width}
      heightM={height}
      position={position}
      movable={false}
      interactive={false}
      fallback={fallback}
      onRendererError={(error) => {
        if (__DEV__) console.warn('[native-board] renderer error', error.message);
      }}
    />
  );
}
