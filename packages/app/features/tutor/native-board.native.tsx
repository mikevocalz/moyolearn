'use client';

import { useEffect, useMemo, useRef, type ReactElement, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { createNativeBoardSceneBridge, type SceneResult } from '@nitro-forge/board/skia';
import { createInkOutlineEncoder } from '@nitro-forge/board';
import { ViroMaterials, ViroQuad } from '@reactvision/react-viro';
import { NitroModules } from 'react-native-nitro-modules';
import { getInkOutline } from '@viro-external/ui';
import { useWhiteboardRenderer } from '@nitro-forge/board/native';
import { boardSurfacePixels } from '@acme/ui/xr';
import { deviceValidationFlags } from './device-validation-flags.ts';
import { createForgeBoardSource } from './forge-board-source.ts';
import type { BoardDoc } from './board-doc.ts';

const SURFACE_WIDTH_PX = boardSurfacePixels.width * 2;
const SURFACE_HEIGHT_PX = boardSurfacePixels.height * 2;
const BOARD_SURFACE_ID = 0x4e4ff000;
const BOARD_MATERIAL = 'moyoNativeBoardPaper';

/** The preview requires an explicitly linked Forge backend; the learner default stays unchanged. */
export function useNativeBoardEnabled(): boolean {
  const requested = useStore(deviceValidationFlags, (s) => s.nativeBoard);
  return requested && NitroModules.hasHybridClass('forgeboard.WhiteboardRendererFactory');
}

export interface NativeBoardPaperProps {
  /** Existing session document; Forge owns only its derived rendering resources. */
  doc: BoardDoc;
  width: number;
  height: number;
  position: [number, number, number];
  /** Existing board when the backend, surface or GPU cannot render. */
  fallback: ReactNode;
}

/**
 * Forge renders the same Yjs board that export, collaboration and persistence use.
 * Input remains in the screen's existing router. There is no second editable
 * QuickDraw store, mirrored pointer subscription or independent undo history.
 * This Android XR surface backend is separate from Forge's Skia v3 2D canvas.
 */
export function NativeBoardPaper({ doc, width, height, position, fallback }: NativeBoardPaperProps): ReactElement {
  const source = useMemo(() => createForgeBoardSource(doc), [doc]);
  const encoder = useMemo(() => createInkOutlineEncoder(getInkOutline), []);
  const sceneRef = useRef<StoreApi<{ scene: SceneResult; failed: boolean }> | null>(null);
  if (sceneRef.current === null) sceneRef.current = createStore<{ scene: SceneResult; failed: boolean }>(() => ({
    scene: { kind: 'unsupported', reasons: ['Preparing board'] }, failed: false,
  }));
  const sceneState = sceneRef.current;
  const scene = useStore(sceneState, (state) => state.scene);
  const failed = useStore(sceneState, (state) => state.failed);
  useEffect(() => {
    const bridge = createNativeBoardSceneBridge({
      source, encodeSnapshot: encoder.encodeSnapshot,
      requestFrame: requestAnimationFrame, cancelFrame: cancelAnimationFrame,
    });
    sceneState.setState({ scene: bridge.state.getState().scene, failed: false });
    const stop = bridge.state.subscribe((state) => sceneState.setState({ scene: state.scene }));
    return () => { stop(); bridge.dispose(); };
  }, [encoder, sceneState, source]);
  const status = useWhiteboardRenderer({
    store: source,
    getInkOutline,
    surfaceId: BOARD_SURFACE_ID,
    widthPx: SURFACE_WIDTH_PX,
    heightPx: SURFACE_HEIGHT_PX,
    pixelRatio: 2,
    cornerRadiusPx: 0,
    backgroundColor: '#FFFFFF',
    onError: () => sceneState.setState({ failed: true }),
  });
  useEffect(() => {
    ViroMaterials.createMaterials({
      [BOARD_MATERIAL]: {
        diffuseTexture: { canvasSource: BOARD_SURFACE_ID, width: SURFACE_WIDTH_PX, height: SURFACE_HEIGHT_PX },
        diffuseColor: '#FFFFFF',
        lightingModel: 'Constant',
      },
    });
    return () => ViroMaterials.deleteMaterials([BOARD_MATERIAL]);
  }, []);
  if (failed || scene.kind !== 'ready' || status.kind === 'unavailable' || status.kind === 'failed') return <>{fallback}</>;
  const drawing = status.kind === 'ready' && status.state === 'active';
  // Keep the surface mounted while the renderer waits for it; otherwise
  // waiting-for-surface can never transition to active. The fallback stays
  // visible until native drawing is confirmed.
  return <>
    <ViroQuad width={width} height={height} position={position} opacity={drawing ? 1 : 0} materials={[BOARD_MATERIAL]} ignoreEventHandling />
    {drawing ? null : fallback}
  </>;
}
