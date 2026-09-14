'use client';
// The spatial panel: one anchor carrying the 5:7 paper, the controls beside it,
// and the conversation turned back toward the child.
//
// WHY THE RAIL IS A SIBLING AND NOT A CHILD. It began as a constraint: the
// panels were `ViroFlexView`s, and the installed renderer respects
// `position`/`rotation`/`scale` on the OUTERMOST flex view only, so a rail
// nested in the board's tree could not carry its own transform. The flex views
// are gone — every panel is stacked quads now (`XrPlate.native.tsx`) — and the
// arrangement stays, on its own merit: both hang off one `ViroNode`, which is
// what makes them move together. The anchor is the thing that gets recentred,
// and neither the board nor the rail knows it happened.
//
// WHY THE POINTER MATH IS HERE. The panel is the only thing that knows its own
// world transform, so it is the only thing that may convert a world hit into a
// surface coordinate. Callers get `(u, v)` in 0–1 and multiply by a pixel size.
// A caller that also transforms gets ink that trails the ray by a fraction of
// the paper — which reads as a tracking fault and is actually two matrices.
//
// NO WEB FORK RENDERS THIS. `XrPanel.web.tsx` is a deliberate non-renderer; see
// its header.
// SOT: packages/ui/xr/XrPanel.types.ts · packages/ui/xr/spatial-tokens.ts · packages/ui/xr/surface-drag.ts
// SOT-KEYWORDS: xr panel viro native spatial ornament companion quad pointer mapping placement drag

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ViroClickStateTypes, ViroNode, ViroQuad, ViroSpinner } from '@reactvision/react-viro';
import { boardComposition, spatialSpacing, spatialTextHeight } from './spatial-tokens.ts';
import { XR_MATERIAL } from './spatial-materials.native.ts';
import { XrLabel, XrPlate } from './XrPlate.native.tsx';
import { xrDragHit, xrDragPlane } from './surface-drag.ts';
import { XR_COLOR } from './xr-colors.ts';
import type { XrPanelProps, XrSurfaceInput, XrVector3 } from './XrPanel.types.ts';

/**
 * A world point, in the panel surface's own frame.
 *
 * YAW ONLY, ON PURPOSE. The board stands upright facing the child and recenter
 * turns it about Y, so a yaw inverse is exact for every placement this feature
 * produces. Pitch and roll are deliberately NOT handled rather than guessed:
 * the order ViroCore composes its Euler angles in is not stated in the
 * installed package's types, and a wrong order does not fail — it puts the ink
 * somewhere plausible and slightly wrong, which is the hardest class of bug to
 * see in a headset. If the composition ever needs to tilt, the order gets
 * confirmed on a device first and this function grows a test.
 */
function toSurfaceLocal(
  world: readonly [number, number, number],
  position: XrVector3,
  yawDeg: number,
  scale: number,
): { x: number; y: number } {
  const dx = world[0] - position[0];
  const dy = world[1] - position[1];
  const dz = world[2] - position[2];
  const yaw = (-yawDeg * Math.PI) / 180;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  /* Inverse yaw about Y, then undo the uniform scale. */
  return {
    x: (dx * cos - dz * sin) / scale,
    y: dy / scale,
  };
}

/**
 * How far the pointer quad stands off the paper, in metres.
 *
 * In front of the ink — `XrBoardInk` draws its strokes at 0.001 — so a ray
 * meets the pointer surface before it meets a line the child already drew. It
 * stays inside the 0.01 the waiting and unsupported panels stand at, which the
 * state union already keeps off the board, so that ordering survives a future
 * state that does share it.
 */
const POINTER_STANDOFF = 0.002;

/**
 * How far past the paper's edge a stroke may stray before it is abandoned.
 *
 * One `xs` of slack, not zero: a fast stroke that overshoots the edge by a
 * fingertip is a child still writing, and the sample is clamped back onto the
 * paper. Beyond it the aim has genuinely left the board.
 */
const POINTER_SLACK = spatialSpacing.xs;

/**
 * Which input device a sample came from, as the contract's number.
 *
 * The installed package types every event's `source` as an image source, which
 * it is not — the renderer sends the numeric input-source id. Narrowed in one
 * place rather than at four call sites.
 */
function sourceId(source: unknown): number {
  return typeof source === 'number' ? source : 0;
}

export function XrPanel({
  width,
  aspect,
  children,
  ornaments,
  companion,
  placement,
  moveHandle = 'frame',
  onPlacementChange,
  onSurfaceInput,
  state,
  materials,
}: XrPanelProps) {
  /* THE ASPECT LOCK. The one line the whole feature's promise rests on. */
  const height = (width * aspect.h) / aspect.w;

  const surfaceMaterial = materials?.surface ?? XR_MATERIAL.paper;
  const frameMaterial = materials?.frame ?? XR_MATERIAL.frame;

  /*
    A stroke in progress, in refs rather than state. A pointer arrives at
    display rate; a `setState` per sample would re-render the scene graph
    between every two points of a child's handwriting.

    `downHit` and `downNode` are the two world points the drag arithmetic needs,
    snapshotted at CLICK_DOWN. `lastSample` is the most recent surface sample,
    which is where a stroke's `end` and `cancel` are reported — never at the
    position the ending event itself carries, for the reason below.
  */
  const drawing = useRef(false);
  const downHit = useRef<XrVector3>([0, 0, 0]);
  const downNode = useRef<XrVector3>([0, 0, 0]);
  const lastSample = useRef({ u: 0, v: 0, source: 0 });
  const pointer = useRef<ViroQuad | null>(null);

  /* The paper's plane, in the world frame the renderer reads it in. */
  const plane = useMemo(
    () =>
      xrDragPlane({
        position: placement.position,
        yawDeg: placement.rotation[1],
        scale: placement.scale,
        offset: POINTER_STANDOFF,
        width,
        height,
      }),
    [height, placement, width],
  );

  /**
   * A world hit as the caller's `(u, v)`, plus how far outside the paper it fell.
   *
   * Clamped, not rejected: a ray a millimetre past the edge during a fast
   * stroke is a child still drawing, and dropping that sample leaves a gap in
   * the line. The overshoot comes back with it because it is the only thing
   * that can tell a live stroke the aim has left the board — a drag reports no
   * hit node, so nothing else in the stream knows.
   */
  const sampleOf = useCallback(
    (world: XrVector3) => {
      const local = toSurfaceLocal(world, placement.position, placement.rotation[1], placement.scale);
      return {
        u: Math.min(1, Math.max(0, local.x / width + 0.5)),
        v: Math.min(1, Math.max(0, 0.5 - local.y / height)),
        overshoot: Math.max(Math.abs(local.x) - width / 2, Math.abs(local.y) - height / 2),
      };
    },
    [height, placement, width],
  );

  const send = useCallback(
    (phase: XrSurfaceInput['phase'], u: number, v: number, source: number) => {
      onSurfaceInput?.({ phase, u, v, source });
    },
    [onSurfaceInput],
  );

  /*
    WHY DRAWING IS A DRAG, AND WHAT `onHover` GOT WRONG.

    This surface used to run a stroke off `onHover`, on the stated belief that
    it was the only continuous positional signal the component exposes. It is
    not a stream at all. `onHover` is an enter/exit event carrying a boolean,
    and the renderer emits it only when the hovered node CHANGES: while a ray
    rests on the same node `VROInputControllerBase` returns without firing
    anything. So a stroke got its `begin`, then silence, then an `end` at the
    same point — the child drew and no line appeared. The belief could not even
    be repaired, because the renderer freezes the hit result for the whole of a
    drag, which is the only other thing a pointer-down does.

    The move stream is that drag. A transparent quad over the paper takes
    `dragType="FixedToPlane"` with `dragPlane` set to the paper's own plane, so
    the renderer slides it under the ray and reports every step through
    `onDrag` — one callback per sampled move, which is what the surface needed
    all along. It is a sampled stream and not a continuous one: the renderer
    drops a move of less than `ON_DRAG_DISTANCE_THRESHOLD`, one centimetre of
    world travel — about fifty samples across the width of a 0.55 m board. That
    floor lives in the installed native renderer and no prop here raises it, so
    a stroke arrives resampled rather than pixel-exact.

    IT IS A SEPARATE QUAD BECAUSE A DRAG MOVES WHAT IT DRAGS. The renderer sets
    the dragged node's world transform on every sample. Run this on the paper
    and a child's homework slides across the room while they write on it; run it
    on a quad nobody can see and nothing visibly moves, as long as the transform
    is put back on release so the displacement cannot accumulate over a session.
  */
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
          through every move that followed, so the press is dropped instead.
          Checked coordinate by coordinate because `[].every()` is true.
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
        Off the paper cancels the stroke and never ends it. A child whose aim has
        run onto the wall is not finishing a line there, and committing one
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

  const drawable = state === 'ready' || state === 'interrupted';

  useEffect(() => {
    if (drawable || !drawing.current) return;
    /*
      The board left mid-stroke: tracking dropped, or the session is on its way
      out. The stroke is abandoned rather than committed, for the same reason a
      ray leaving the paper abandons one.
    */
    drawing.current = false;
    send('cancel', lastSample.current.u, lastSample.current.v, lastSample.current.source);
  }, [drawable, send]);

  const surface = drawable ? (
    <ViroNode position={[0, 0, 0]}>
      {/*
        The paper. Opaque and light in both schemes — the measured rule in
        `whiteboard.types.ts` — so it is never a translucent panel a child is
        asked to read their own pencil work through.
      */}
      <ViroQuad
        width={width}
        height={height}
        materials={[surfaceMaterial]}
        /*
          The paper neither moves nor handles events: the frame carries the move
          gesture and the pointer quad in front carries every ray. The renderer
          takes the nearest hit that is not ignoring events, so this flag is what
          hands a ray past the paper to the quad that knows what to do with it.
        */
        ignoreEventHandling
      />
      {/*
        The ink is out of the ray's way for the same reason, and one flag does
        it: `ignoreEventHandling` recurses into a node's children, so every
        stroke is covered without `XrBoardInk` knowing this surface is drawable.
        It also stops a polyline from becoming the thing a drag picks up.
      */}
      <ViroNode ignoreEventHandling>{children}</ViroNode>
      {/*
        The pointer surface. Invisible, in front of everything drawable, and the
        only node on the board that answers a ray.
      */}
      <ViroQuad
        ref={pointer}
        position={[0, 0, POINTER_STANDOFF]}
        width={width}
        height={height}
        materials={[XR_MATERIAL.pointer]}
        dragType="FixedToPlane"
        dragPlane={plane}
        /*
          Hit-test the geometry, not the bounding box. `highAccuracyEvents` is
          the prop the component schema names for this (`highAccuracyGaze` is its
          deprecated spelling), and it is the one thing this surface — whose only
          job is to be hit accurately — was not asking for. Not yet confirmed on
          device.
        */
        highAccuracyEvents
        onClickState={onPointerClickState}
        onDrag={onPointerDrag}
      />
    </ViroNode>
  ) : null;

  return (
    <ViroNode
      position={[...placement.position] as [number, number, number]}
      rotation={[...placement.rotation] as [number, number, number]}
      scale={[placement.scale, placement.scale, placement.scale]}
    >
      {/*
        The frame sits a hair behind the paper and is the grab affordance. It is
        wider than the board by one `sm` on every side, which is what makes it
        reachable without covering the writing surface.
      */}
      <ViroQuad
        position={[0, 0, -0.005]}
        width={width + spatialSpacing.sm}
        height={height + spatialSpacing.sm}
        materials={[frameMaterial]}
        dragType={moveHandle === 'frame' ? 'FixedDistance' : undefined}
        onDrag={
          moveHandle === 'frame' && onPlacementChange
            ? (dragToPos) =>
                onPlacementChange({
                  ...placement,
                  position: [dragToPos[0], dragToPos[1], dragToPos[2]],
                })
            : undefined
        }
      />

      {surface}

      {state === 'checking' || state === 'preparing' ? (
        /*
          A branded wait, never a blank board. An empty 5:7 rectangle that looks
          finished is a child drawing onto a surface that is about to be
          replaced by their restored working.
        */
        <ViroNode position={[0, 0, 0.01]}>
          <ViroSpinner type="dark" position={[0, 0.08, 0]} scale={[0.14, 0.14, 0.14]} />
          <XrLabel
            text={state === 'checking' ? 'Getting your board ready' : 'Bringing your working over'}
            position={[0, -0.06, 0]}
            width={width * 0.8}
            /* Two lines of body type, so the box is the size of what goes in
               it. It was 0.12 m holding a 22 pt glyph, which is 0.22 m. */
            height={spatialTextHeight.body * 2}
            step="body"
            /* Light ink: this sits on the frame quad's near-black while the
               paper is not drawn yet, and the dark ink measured 1.08:1. */
            color={XR_COLOR.onPanel}
            align="center"
            maxLines={2}
          />
        </ViroNode>
      ) : null}

      {state === 'unsupported' ? (
        /*
          A card, not a flex view. The padding was `0.04` — the last raw length
          in this file — and it is `xs` now, which is what every other panel in
          the feature insets its content by.
        */
        <XrPlate
          position={[0, 0, 0.01]}
          width={width}
          height={height * 0.5}
          material={XR_MATERIAL.card}
        >
          <XrLabel
            text="This headset can't open the spatial whiteboard yet. Your board is waiting on the normal screen — nothing is lost."
            width={width - spatialSpacing.xs * 2}
            height={height * 0.5 - spatialSpacing.xs * 2}
            step="body"
            color={XR_COLOR.onPanel}
          />
        </XrPlate>
      ) : null}

      {ornaments?.leading ? (
        <ViroNode
          position={[
            -(width / 2 + ornaments.leading.gap + ornaments.leading.extent / 2),
            0,
            0,
          ]}
        >
          {ornaments.leading.node}
        </ViroNode>
      ) : null}

      {ornaments?.top ? (
        <ViroNode position={[0, height / 2 + ornaments.top.gap + ornaments.top.extent / 2, 0]}>
          {ornaments.top.node}
        </ViroNode>
      ) : null}

      {ornaments?.bottom ? (
        <ViroNode
          position={[0, -(height / 2 + ornaments.bottom.gap + ornaments.bottom.extent / 2), 0]}
        >
          {ornaments.bottom.node}
        </ViroNode>
      ) : null}

      {companion ? (
        /*
          The conversation, in the peripheral zone and yawed back so it is read
          rather than glanced past. Its own Z offset keeps it off the board's
          plane: two user-facing panels sharing a plane at this distance read as
          one wide panel with a seam.
        */
        <ViroNode
          position={[
            (companion.zone === 'peripheralRight' ? 1 : -1) *
              (width / 2 + companion.gap + companion.width / 2),
            0,
            boardComposition.chatGap * 2,
          ]}
          rotation={[0, companion.yawDeg, 0]}
        >
          {companion.node}
        </ViroNode>
      ) : null}
    </ViroNode>
  );
}
