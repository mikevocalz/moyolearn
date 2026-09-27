'use client';
// Controller rays and spatial styli share the board panel's world placement.
// Viro FixedToPlane drag reports the moved quad centre, so preserve the initial
// grab offset before converting into the engine's normalized viewport.
// SOT: premium/PremiumXRMediaPanel.tsx · surface-drag.ts · board-pointer.ts
// SOT-KEYWORDS: xr board controller muse stylus input drawing pointer ownership drag
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { NativeEventEmitter, NativeModules } from 'react-native';
import { ViroClickStateTypes, ViroNode, ViroQuad } from '@reactvision/react-viro';
import { panelMediaArea } from './premium/PremiumXRMediaPanel.tsx';
import { XR_MATERIAL } from './spatial-materials.native.ts';
import { xrDragHit, xrDragPlane, xrSurfaceLocal } from './surface-drag.ts';
import { worldSlot, xrRotateY } from './world-slot.ts';
import { BoardPointer } from './board-pointer.ts';
import { SpatialStylusBoardInput, SPATIAL_STYLUS_SOURCE, type SpatialStylusFrame } from './spatial-stylus-board-input.ts';
import type { XrVector3, XrSurfaceInput } from './XrPanel.types.ts';
import type { XrBoardSurfaceProps } from './XrBoardSurface.types.ts';

const POINTER_STANDOFF = 0.002;
function sourceId(source: unknown): number { return typeof source === 'number' ? source : 0; }
export function XrBoardSurface({ headPosition, headYawDeg, enabled, termination, onSurfaceInput, anchor: anchorOverride, area: areaOverride }: XrBoardSurfaceProps) {
  const stroke = useRef(new BoardPointer());
  const stylus = useRef(new SpatialStylusBoardInput(stroke.current));
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
  useEffect(() => {
    const module = NativeModules.VRTVisionOSModule;
    if (!enabled || module?.isVisionOS !== true) return;

    // The pen and the controller share BoardPointer, so neither can take over
    // the other's line. The native sample is already in this scene's world space.
    const subscription = new NativeEventEmitter(module).addListener(
      'onSpatialStylus',
      (frame: SpatialStylusFrame) => {
        const sample = stylus.current.handle(frame, {
          position: anchor.position, yawDeg: anchor.yaw,
          width: area.width, height: area.height, plane,
        });
        if (sample) emit.current(sample);
      },
    );
    return () => {
      subscription.remove();
      const sample = stylus.current.reset();
      if (sample) emit.current(sample);
    };
  }, [enabled, anchor, area.width, area.height, plane]);
  if (!enabled) return null;
  return (
    <ViroNode position={anchor.position} rotation={[0, anchor.yaw, 0]}>
      <ViroQuad ref={pointer} position={[0, 0, POINTER_STANDOFF]}
        width={area.width} height={area.height} materials={[XR_MATERIAL.pointer]}
        /*
          `dragTransform="none"` is the half of the drag contract this quad was
          missing. `FixedToPlane` asks Viro to compute the ray/plane hit every
          frame, but without it Viro also MOVES the quad to that hit — so the
          input plane travels with the controller, every drag report resolves
          to the point the press started on, and `move()` never advances past
          the `begin`. That is why a stroke arrived as begin+end at identical
          coordinates and the board stayed blank.
        */
        dragType="FixedToPlane" dragTransform="none" dragPlane={plane}
        highAccuracyEvents
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
          /* `onClickState` reports the BUTTON (A = 5, grip = 9), `onDrag`
             reports the RAY the button rides (right controller = 1) — a
             button-opened stroke owns 5, so checking `owns(1)` drops every
             move and the stroke collapses to a dot. The renderer only emits
             drags for the owning ray anyway, so while a stroke is open a drag
             IS that stroke's — keep the move under the owner's id so the
             begin/move/end stream carries one consistent source. */
          const id = stroke.current.source;
          if (id === null || id === SPATIAL_STYLUS_SOURCE) return;
          const hit = xrDragHit(position, downHit.current, plane.planePoint);
          send(stroke.current.move(sampleOf(hit, id)));
          if (!stroke.current.active) restPointer();
        }}
      />
    </ViroNode>
  );
}
