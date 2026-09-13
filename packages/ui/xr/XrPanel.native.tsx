'use client';
// The spatial panel: one anchor carrying the 5:7 paper, the controls beside it,
// and the conversation turned back toward the child.
//
// WHY THE RAIL IS A SIBLING AND NOT A CHILD. The installed ViroReact's flexbox
// docs are explicit that only `ViroText`, `ViroImage`, `ViroVideo`,
// `ViroButton`, `ViroSpinner` and nested `ViroFlexView`s may go inside a
// `ViroFlexView`, and that `position`/`rotation`/`scale` are respected on the
// OUTERMOST one only. So a rail nested in the board's flex tree could not carry
// its own transform, and a board nested in a rail's could not either. Both hang
// off one `ViroNode` instead, which is also what makes them move together: the
// anchor is the thing that gets recentred, and neither knows it happened.
//
// WHY THE POINTER MATH IS HERE. The panel is the only thing that knows its own
// world transform, so it is the only thing that may convert a world hit into a
// surface coordinate. Callers get `(u, v)` in 0–1 and multiply by a pixel size.
// A caller that also transforms gets ink that trails the ray by a fraction of
// the paper — which reads as a tracking fault and is actually two matrices.
//
// NO WEB FORK RENDERS THIS. `XrPanel.web.tsx` is a deliberate non-renderer; see
// its header.
// SOT: packages/ui/xr/XrPanel.types.ts · packages/ui/xr/spatial-tokens.ts
// SOT-KEYWORDS: xr panel viro native spatial ornament companion quad pointer mapping placement drag

import { useCallback, useRef } from 'react';
import {
  ViroClickStateTypes,
  ViroFlexView,
  ViroNode,
  ViroQuad,
  ViroSpinner,
  ViroText,
} from '@reactvision/react-viro';
import { boardComposition, spatialSpacing } from './spatial-tokens.ts';
import { XR_MATERIAL } from './spatial-materials.native.ts';
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
    A stroke in progress, in a ref rather than state. A pointer arrives at
    display rate; a `setState` per sample would re-render the scene graph
    between every two points of a child's handwriting.
  */
  const drawing = useRef(false);

  const emit = useCallback(
    (phase: XrSurfaceInput['phase'], world: readonly [number, number, number], source: unknown) => {
      if (!onSurfaceInput) return;
      const local = toSurfaceLocal(world, placement.position, placement.rotation[1], placement.scale);
      /*
        Clamped, not rejected. A ray a millimetre past the edge during a fast
        stroke is a child still drawing, and dropping that sample leaves a gap
        in the line; a ray that has genuinely left the paper arrives as
        `cancel` from `onHover` instead.
      */
      const u = Math.min(1, Math.max(0, local.x / width + 0.5));
      const v = Math.min(1, Math.max(0, 0.5 - local.y / height));
      onSurfaceInput({ phase, u, v, source: typeof source === 'number' ? source : 0 });
    },
    [height, onSurfaceInput, placement, width],
  );

  const onClickState = useCallback(
    (clickState: number, position: readonly [number, number, number], source: unknown) => {
      if (clickState === ViroClickStateTypes.CLICK_DOWN) {
        drawing.current = true;
        emit('begin', position, source);
      } else if (clickState === ViroClickStateTypes.CLICK_UP && drawing.current) {
        drawing.current = false;
        emit('end', position, source);
      }
    },
    [emit],
  );

  /*
    HOVER IS THE MOVE STREAM. It fires continuously while a ray rests on the
    node, which is the only continuous positional signal the installed
    component exposes for a surface that is not being dragged — `onDrag` reports
    where a NODE was dragged to, which is a different question, and `onTouch` is
    a screen-touch path rather than a ray one.

    `isHovering === false` mid-stroke is the ray leaving the paper: the stroke is
    cancelled rather than ended, so the engine does not commit a line to
    wherever the child happened to look.
  */
  const onHover = useCallback(
    (isHovering: boolean, position: readonly [number, number, number], source: unknown) => {
      if (!drawing.current) return;
      if (isHovering) emit('move', position, source);
      else {
        drawing.current = false;
        emit('cancel', position, source);
      }
    },
    [emit],
  );

  const surface =
    state === 'ready' || state === 'interrupted' ? (
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
          onClickState={onClickState}
          onHover={onHover}
          /* The paper does not move; the frame does. */
          dragType={undefined}
        />
        {children}
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
          <ViroText
            text={state === 'checking' ? 'Getting your board ready' : 'Bringing your working over'}
            position={[0, -0.06, 0]}
            width={width * 0.8}
            height={0.12}
            style={{ fontSize: 22, color: '#1a1d24', textAlign: 'center' }}
            textLineBreakMode="WordWrap"
          />
        </ViroNode>
      ) : null}

      {state === 'unsupported' ? (
        <ViroFlexView
          position={[0, 0, 0.01]}
          width={width}
          height={height * 0.5}
          materials={[XR_MATERIAL.card]}
          style={{ padding: 0.04, flexDirection: 'column', justifyContent: 'center' }}
        >
          <ViroText
            text="This headset can't open the spatial whiteboard yet. Your board is waiting on the normal screen — nothing is lost."
            style={{ fontSize: 24, color: '#f8fafc' }}
            textLineBreakMode="WordWrap"
          />
        </ViroFlexView>
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
