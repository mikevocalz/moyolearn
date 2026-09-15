'use client';
// The invisible quad over the centre panel's board — the only node in the arc
// that turns a controller ray into ink.
//
// WHY IT IS NOT INSIDE THE PANEL. `PremiumXRMediaPanel` is vendored from
// poke-xr whole, and it is vendored whole on purpose: it renders art, not a
// drawing surface, and teaching it to draw would fork the one file this route
// most needs to keep in step with upstream. The surface is a sibling placed at
// the same world pose instead — same `worldSlot('center', …)` call the panel
// itself is placed by, so the two cannot drift apart.
//
// WHY DRAWING IS A DRAG. `onHover` is an enter/exit event, not a stream: the
// renderer fires it only when the hovered node CHANGES, so a ray resting on the
// board reports a `begin`, then silence, then an `end` at the same point — the
// child draws and no line appears. A `dragType="FixedToPlane"` quad on the
// board's own plane is the stream; the renderer slides it under the ray and
// reports every step through `onDrag`. That is why the quad has to be separate
// from the art as well: a drag MOVES what it drags, and dragging the panel
// would slide a child's homework across the room while they write on it. The
// displacement is put back on every release so it cannot accumulate.
//
// The proven handlers are `XrPanel`'s, ported rather than reinvented — the
// empty-payload guard, the overshoot cancel, and the "end at the last MOVE"
// rule are each a device-found bug, and each comment says which.
// SOT: packages/ui/xr/XrPanel.native.tsx · packages/ui/xr/surface-drag.ts · packages/ui/xr/world-slot.ts
// SOT-KEYWORDS: xr board surface pointer quad draw drag plane stroke ink controller ray centre panel

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ViroClickStateTypes, ViroNode, ViroQuad } from '@reactvision/react-viro';
import { panelMediaArea } from './premium/PremiumXRMediaPanel.tsx';
import { spatialSpacing } from './spatial-tokens.ts';
import { XR_MATERIAL } from './spatial-materials.native.ts';
import { xrDragHit, xrDragPlane, xrSurfaceLocal } from './surface-drag.ts';
import { worldSlot, xrRotateY } from './world-slot.ts';
import type { XrVector3 } from './XrPanel.types.ts';
import type { XrBoardSurfaceProps } from './XrBoardSurface.types.ts';

/**
 * How far the pointer quad stands off the board, in metres.
 *
 * In front of the panel's art plane, so a ray meets the surface before it meets
 * the raster of what the child already drew. Small enough that the parallax
 * between where they aim and where the ink lands stays under a millimetre at
 * the arc's radius.
 */
const POINTER_STANDOFF = 0.002;

/**
 * How far past the board's edge a stroke may stray before it is abandoned.
 *
 * One `xs` of slack, not zero: a fast stroke that overshoots the edge by a
 * fingertip is a child still writing, and the sample is clamped back on.
 */
const POINTER_SLACK = spatialSpacing.xs;

/**
 * Which input device a sample came from, as the contract's number.
 *
 * The installed package types every event's `source` as an image source, which
 * it is not — the renderer sends the numeric input-source id.
 */
function sourceId(source: unknown): number {
  return typeof source === 'number' ? source : 0;
}

export function XrBoardSurface({
  headPosition,
  headYawDeg,
  enabled,
  onSurfaceInput,
}: XrBoardSurfaceProps) {
  /*
    A stroke in progress, in refs rather than state. A pointer arrives at
    display rate; a `setState` per sample would re-render the scene graph
    between every two points of a child's handwriting.
  */
  const drawing = useRef(false);
  const downHit = useRef<XrVector3>([0, 0, 0]);
  const downNode = useRef<XrVector3>([0, 0, 0]);
  const lastSample = useRef({ u: 0, v: 0, source: 0 });
  const pointer = useRef<ViroQuad | null>(null);

  /* The board rectangle, from the panel that owns it — never restated here. */
  const area = panelMediaArea('boardPanel');

  /*
    The board's own anchor in world space: the centre slot, then the header's
    bite out of the body, then the art plane's depth — each turned by the
    child's facing with the SAME rotation ViroCore composes, so the quad, the
    drag plane and the panel all agree about which way the board points.
  */
  const anchor = useMemo(() => {
    const slot = worldSlot('center', headPosition, headYawDeg);
    const [ox, oy, oz] = xrRotateY([0, area.centerY, area.z], slot.yaw);
    return {
      position: [
        slot.position[0] + ox,
        slot.position[1] + oy,
        slot.position[2] + oz,
      ] as [number, number, number],
      yaw: slot.yaw,
    };
  }, [area.centerY, area.z, headPosition, headYawDeg]);

  const plane = useMemo(
    () =>
      xrDragPlane({
        position: anchor.position,
        yawDeg: anchor.yaw,
        scale: 1,
        offset: POINTER_STANDOFF,
        width: area.width,
        height: area.height,
      }),
    [anchor, area.height, area.width],
  );

  /**
   * A world hit as the caller's `(u, v)`, plus how far outside the board it fell.
   *
   * Clamped, not rejected: a ray a millimetre past the edge during a fast
   * stroke is a child still drawing, and dropping that sample leaves a gap in
   * the line. The overshoot comes back with it because it is the only thing
   * that can tell a live stroke the aim has left the board — a drag reports no
   * hit node, so nothing else in the stream knows.
   */
  const sampleOf = useCallback(
    (world: XrVector3) => {
      const local = xrSurfaceLocal(world, anchor.position, anchor.yaw, 1);
      return {
        u: Math.min(1, Math.max(0, local.x / area.width + 0.5)),
        v: Math.min(1, Math.max(0, 0.5 - local.y / area.height)),
        overshoot: Math.max(
          Math.abs(local.x) - area.width / 2,
          Math.abs(local.y) - area.height / 2,
        ),
      };
    },
    [anchor, area.height, area.width],
  );

  const send = useCallback(
    (phase: 'begin' | 'move' | 'end' | 'cancel', u: number, v: number, source: number) => {
      onSurfaceInput({ phase, u, v, source });
    },
    [onSurfaceInput],
  );

  const restPointer = useCallback(() => {
    /*
      Straight at the native node, not through React. React still believes the
      quad is where it last rendered it — the renderer moved it behind React's
      back — so a re-render would not put it back, and a state round trip would
      land a frame into the next stroke.
    */
    pointer.current?.setNativeProps({ position: [0, 0, POINTER_STANDOFF] });
  }, []);

  const onPointerClickState = useCallback(
    (clickState: number, position: XrVector3, source: unknown) => {
      if (clickState === ViroClickStateTypes.CLICK_DOWN) {
        /*
          A press that carries no hit position. The renderer sends an EMPTY
          payload when a click is re-routed onto a node the ray has just left —
          its click grace — or when it lands on the scene background; each
          coordinate then reads as `undefined`, and NaN from here on. A stroke
          begun there would be drawn nowhere AND would carry the bad origin
          through every move that followed. Checked coordinate by coordinate
          because `[].every()` is true.
        */
        if (
          !Number.isFinite(position[0]) ||
          !Number.isFinite(position[1]) ||
          !Number.isFinite(position[2])
        ) {
          return;
        }
        /* A second press with a stroke still open is a release that was lost. */
        if (drawing.current) {
          send('cancel', lastSample.current.u, lastSample.current.v, lastSample.current.source);
        }
        const sample = sampleOf(position);
        const id = sourceId(source);
        drawing.current = true;
        downHit.current = position;
        /*
          The quad is at rest when the press lands — every release puts it back
          — so its world centre is exactly the plane point it was given.
        */
        downNode.current = plane.planePoint;
        lastSample.current = { u: sample.u, v: sample.v, source: id };
        send('begin', sample.u, sample.v, id);
        return;
      }
      if (clickState !== ViroClickStateTypes.CLICK_UP) return;
      /* Every release rests the quad, including one ending a cancelled stroke. */
      restPointer();
      if (!drawing.current) return;
      drawing.current = false;
      /*
        Ended at the last MOVE, never at this event's own position. The renderer
        freezes the hit result for the duration of a drag, so the position that
        arrives with CLICK_UP is still the one from CLICK_DOWN: ending a stroke
        there would snap its final point back to where the child began it.
      */
      send('end', lastSample.current.u, lastSample.current.v, lastSample.current.source);
    },
    [plane, restPointer, sampleOf, send],
  );

  const onPointerDrag = useCallback(
    (dragToPos: XrVector3, source: unknown) => {
      if (!drawing.current) return;
      /* `dragToPos` is where the QUAD went; `xrDragHit` turns it back into the ray's hit. */
      const sample = sampleOf(xrDragHit(dragToPos, downHit.current, downNode.current));
      const id = sourceId(source);
      /*
        Off the board cancels the stroke and never ends it. A child whose aim
        has run onto the wall is not finishing a line there, and committing one
        leaves them a stroke whose end they never chose.
      */
      if (sample.overshoot > POINTER_SLACK) {
        drawing.current = false;
        send('cancel', sample.u, sample.v, id);
        return;
      }
      lastSample.current = { u: sample.u, v: sample.v, source: id };
      send('move', sample.u, sample.v, id);
    },
    [sampleOf, send],
  );

  useEffect(() => {
    if (enabled || !drawing.current) return;
    /*
      The board left mid-stroke: tracking dropped, or the session is on its way
      out. The stroke is abandoned rather than committed, for the same reason a
      ray leaving the board abandons one.
    */
    drawing.current = false;
    send('cancel', lastSample.current.u, lastSample.current.v, lastSample.current.source);
  }, [enabled, send]);

  if (!enabled) return null;

  return (
    <ViroNode position={anchor.position} rotation={[0, anchor.yaw, 0]}>
      <ViroQuad
        ref={pointer}
        position={[0, 0, POINTER_STANDOFF]}
        width={area.width}
        height={area.height}
        materials={[XR_MATERIAL.pointer]}
        dragType="FixedToPlane"
        dragPlane={plane}
        /*
          Hit-test the geometry, not the bounding box. `highAccuracyEvents` is
          the prop the component schema names for this (`highAccuracyGaze` is
          its deprecated spelling), and this surface's only job is to be hit
          accurately.
        */
        highAccuracyEvents
        onClickState={onPointerClickState}
        onDrag={onPointerDrag}
      />
    </ViroNode>
  );
}
