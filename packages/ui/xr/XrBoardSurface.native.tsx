'use client';
// Controller rays share the board panel's dimensions and world placement.
// Viro FixedToPlane drag reports the moved quad centre, so preserve the initial
// grab offset before converting into the engine's normalized viewport.
// SOT: premium/PremiumXRMediaPanel.tsx · surface-drag.ts · board-pointer.ts
// SOT-KEYWORDS: xr board controller input drawing pointer ownership drag
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { ViroClickStateTypes, ViroNode, ViroQuad } from '@reactvision/react-viro';
import { panelMediaArea } from './premium/PremiumXRMediaPanel.tsx';
import { XR_MATERIAL } from './spatial-materials.native.ts';
import { xrDragHit, xrDragPlane, xrSurfaceLocal } from './surface-drag.ts';
import { worldSlot, xrRotateY } from './world-slot.ts';
import { BoardPointer } from './board-pointer.ts';
import type { XrVector3, XrSurfaceInput } from './XrPanel.types.ts';
import type { XrBoardSurfaceProps } from './XrBoardSurface.types.ts';

const POINTER_STANDOFF = 0.002;
function sourceId(source: unknown): number { return typeof source === 'number' ? source : 0; }
export function XrBoardSurface({ headPosition, headYawDeg, enabled, termination, onSurfaceInput, anchor: anchorOverride, area: areaOverride }: XrBoardSurfaceProps) {
  const stroke = useRef(new BoardPointer());
  const downHit = useRef<XrVector3>([0, 0, 0]);
  const pointer = useRef<ViroQuad | null>(null);
  const emit = useRef(onSurfaceInput);
  useLayoutEffect(() => { emit.current = onSurfaceInput; }, [onSurfaceInput]);
  const defaultArea = panelMediaArea('boardPanel');
  const area = areaOverride ?? defaultArea;
  const anchor = useMemo(() => {
    if (anchorOverride) {
      const p = anchorOverride.position;
      return { position: [p[0], p[1], p[2]] as [number, number, number], yaw: anchorOverride.yawDeg };
    }
    const slot = worldSlot('center', headPosition, headYawDeg);
    const offset = xrRotateY([0, defaultArea.centerY, defaultArea.z], slot.yaw);
    return {
      position: slot.position.map((n, i) => n + offset[i]!) as [number, number, number],
      yaw: slot.yaw,
    };
  }, [anchorOverride, headPosition, headYawDeg, defaultArea.centerY, defaultArea.z]);
  const plane = useMemo(() => xrDragPlane({
    position: anchor.position, yawDeg: anchor.yaw, scale: 1,
    offset: POINTER_STANDOFF, width: area.width, height: area.height,
  }), [anchor, area.width, area.height]);
  const sampleOf = (world: XrVector3, source: number) => {
    const local = xrSurfaceLocal(world, anchor.position, anchor.yaw, 1);
    return { u: local.x / area.width + 0.5, v: 0.5 - local.y / area.height, source };
  };
  const restPointer = useCallback(() => {
    pointer.current?.setNativeProps({ position: [0, 0, POINTER_STANDOFF] });
  }, []);
  const send = (sample: XrSurfaceInput | null) => {
    if (sample) emit.current(sample);
  };
  useEffect(() => () => {
    const sample = stroke.current.cancel();
    if (sample) emit.current(sample);
    restPointer();
  }, [enabled, anchor, restPointer]);
  useEffect(() => {
    if (!termination) return;
    const sample = stroke.current.finish(termination.source, termination.cancel);
    if (sample) { emit.current(sample); restPointer(); }
  }, [termination, restPointer]);
  if (!enabled) return null;
  return (
    <ViroNode position={anchor.position} rotation={[0, anchor.yaw, 0]}>
      <ViroQuad ref={pointer} position={[0, 0, POINTER_STANDOFF]}
        width={area.width} height={area.height} materials={[XR_MATERIAL.pointer]}
        dragType="FixedToPlane" dragPlane={plane}
        onClickState={(state, position, source) => {
          const id = sourceId(source);
          /* Draw-path evidence: a CLICK_DOWN line here proves the ray hit the
             input plane; silence while the board is aimed at means the quad
             never sees the ray. Dev-only. */
          if (__DEV__) console.log('[XrBoardSurface] clickState', state, 'pos', position, 'src', id);
          if (state === ViroClickStateTypes.CLICK_DOWN) {
            if (![position[0], position[1], position[2]].every(Number.isFinite)) return;
            const sample = stroke.current.begin(sampleOf(position, id));
            if (sample) { downHit.current = position; send(sample); }
          } else if (state === ViroClickStateTypes.CLICK_UP) {
            if (stroke.current.active && !stroke.current.owns(id)) return;
            send(stroke.current.finish(id));
            restPointer();
          }
        }}
        onDrag={(position, source) => {
          const id = sourceId(source);
          if (!stroke.current.owns(id)) return;
          const hit = xrDragHit(position, downHit.current, plane.planePoint);
          send(stroke.current.move(sampleOf(hit, id)));
          if (!stroke.current.active) restPointer();
        }}
      />
    </ViroNode>
  );
}
