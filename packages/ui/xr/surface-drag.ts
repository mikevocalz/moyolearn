// The two world-space numbers that decide where a child's spatial ink lands.
//
// WHY THIS IS NOT INSIDE THE COMPONENT. Drawing on the paper is implemented as
// a drag confined to the paper's own plane (see the pointer block in
// `XrPanel.native.tsx` for why it is a drag at all). That costs two pieces of
// arithmetic that are invisible when wrong and merely *plausible* when
// slightly wrong — the plane the drag is confined to, and the point on it the
// drag actually names, because ViroCore's `onDrag` reports where the NODE was
// moved to rather than where the ray struck. Neither can be checked by looking
// through a headset: a stroke half a centimetre off the aim reads as tracking
// drift, not as a sign error. So both live here, with no renderer attached, and
// are asserted in `surface-drag.test.ts` instead.
//
// ENGINE CONTRACT THESE ENCODE. `VROInputControllerBase` intersects the
// controller's WORLD ray with the node's configured drag plane
// (`getPlaneIntersect`), so `dragPlane` is read in world space and not in the
// dragged node's own frame. `getDragPositionFixedToPlane` then returns
// `nodeWorldPositionAtGrab + (planeIntersectNow − planeIntersectAtGrab)`, which
// is what `onDrag` hands to JS.
// SOT: packages/ui/xr/XrPanel.types.ts · node_modules/@reactvision/react-viro/dist/components/AR/ViroCommonProps.d.ts
// SOT-KEYWORDS: xr drag plane pointer hit world space viro fixedtoplane surface stroke reconstruct maxdistance

import type { XrVector3 } from './XrPanel.types.ts';

/** A world-space plane, in the exact shape ViroCore's `dragPlane` prop takes. */
export interface XrDragPlane {
  planePoint: [number, number, number];
  planeNormal: [number, number, number];
  maxDistance: number;
}

export interface XrDragPlaneInput {
  /** The panel anchor's world position — `XrPlacement.position`. */
  position: XrVector3;
  /** The anchor's yaw. Only Y is used, for the reason `xrSurfaceLocal` states. */
  yawDeg: number;
  /** The anchor's uniform scale. */
  scale: number;
  /** The pointer quad's offset from the anchor along the panel's own +Z, unscaled. */
  offset: number;
  /** The paper in metres, before `scale`. */
  width: number;
  height: number;
}

/**
 * The plane a pointer drag is confined to: the paper's own, in world space.
 *
 * WORLD, NOT LOCAL, AND THAT IS NOT A STYLE CHOICE. The renderer intersects the
 * controller's world-space ray with these two vectors directly, so a plane
 * expressed in the panel's local frame would be a plane somewhere else in the
 * room — and the stroke would still draw, just not where the child aimed.
 *
 * A quad's face points along its own +Z, so the panel's yaw is the only thing
 * between the local normal and the world one. The `[sin, 0, cos]` column is
 * ViroCore's own Y rotation (`VROMatrix4f::rotateY`), read off the matrix
 * rather than assumed, because the two possible sign conventions differ only
 * for a turned board and both look reasonable in a screenshot.
 */
export function xrDragPlane({
  position,
  yawDeg,
  scale,
  offset,
  width,
  height,
}: XrDragPlaneInput): XrDragPlane {
  // A non-finite plane is a stroke that lands somewhere unrelated to the ray
  // that drew it, so it throws here rather than reaching the renderer — the
  // rule `layoutBoard` follows, for the same reason.
  if (![position[0], position[1], position[2], yawDeg, scale, offset, width, height].every(Number.isFinite)) {
    throw new RangeError('xrDragPlane: non-finite placement');
  }

  const yaw = (yawDeg * Math.PI) / 180;
  const planeNormal: [number, number, number] = [Math.sin(yaw), 0, Math.cos(yaw)];

  /* The quad sits `offset` in front of the anchor along that same normal. */
  const standoff = offset * scale;
  const planePoint: [number, number, number] = [
    position[0] + planeNormal[0] * standoff,
    position[1],
    position[2] + planeNormal[2] * standoff,
  ];

  /*
    HOW FAR A DRAG MAY REACH. Past `maxDistance` the renderer stops following
    the ray and clamps the intersection onto a circle at that distance, so this
    is what decides whether a child who sweeps their arm parks the stroke at the
    edge of their paper or flings the pointer quad across the room.

    Head to board, plus half the paper's diagonal: every point of the paper is
    inside it and almost nothing else is. It must also exceed the head-to-plane
    distance or the renderer's clamp takes the root of a negative number — the
    board centre lies in the plane, so the first term guarantees that.
    `[0,0,0]` is the child's head (`XrPanel.types.ts`).
  */
  const reach = Math.hypot(width * scale, height * scale) / 2;
  const maxDistance = Math.hypot(planePoint[0], planePoint[1], planePoint[2]) + reach;

  return { planePoint, planeNormal, maxDistance };
}

/**
 * Where the ray struck, from where the renderer put the node.
 *
 * `onDrag` answers a different question than the one a drawing surface asks. It
 * reports the dragged node's new position, which the renderer computes as
 * `nodeWorldPositionAtGrab + (planeIntersectNow − planeIntersectAtGrab)`. Every
 * term but `planeIntersectNow` is known at CLICK_DOWN, so the hit falls out by
 * rearranging:
 *
 *     hit = dragToPos + (downHit − downNodePosition)
 *
 * The correction is the grab offset — where on the quad the child started the
 * stroke. Drop it and every stroke is drawn from the quad's CENTRE, which is
 * the failure that looks like a calibration problem: the line is the right
 * shape and in the wrong place, by exactly how far off-centre the child began.
 */
export function xrDragHit(
  dragToPos: XrVector3,
  downHit: XrVector3,
  downNodePosition: XrVector3,
): [number, number, number] {
  return [
    dragToPos[0] + (downHit[0] - downNodePosition[0]),
    dragToPos[1] + (downHit[1] - downNodePosition[1]),
    dragToPos[2] + (downHit[2] - downNodePosition[2]),
  ];
}

/**
 * A world point, in the panel surface's own frame.
 *
 * IT LIVES HERE NOW, AND THE MOVE IS THE POINT. It was a private function in
 * `XrPanel.native.tsx` carrying a sign error that ADR-117 recorded as dormant:
 * it negated the yaw and then used the inverse formula, which applies the
 * negation twice. Harmless only while every placement had `rotation: [0,0,0]`,
 * where `sinθ` is zero and the two expressions agree. Placement now comes from
 * the child's own head pose and the board is TURNED to face them, so the error
 * is live — and the one thing it produces is ink that lands somewhere plausible
 * and slightly wrong, which reads as tracking drift rather than as a bug.
 *
 * THE INVERSE, DERIVED FROM THE FORWARD TRANSFORM IN THIS SAME FILE.
 * `xrDragPlane` takes the panel's facing normal to be `[sinθ, 0, cosθ]`, which
 * is `R_y(θ)·(0,0,1)` — the renderer rotates a local point by
 * `x' = x·cosθ + z·sinθ`, `z' = −x·sinθ + z·cosθ`. Inverting that gives
 * `x = dx·cosθ − dz·sinθ`. One file now holds both directions, so they cannot
 * drift apart again.
 *
 * YAW ONLY, ON PURPOSE. The board stands upright facing the child and both
 * recenter and the initial placement turn it about Y alone, so a yaw inverse is
 * exact for every placement this feature produces. Pitch and roll are
 * deliberately NOT handled rather than guessed: the order ViroCore composes its
 * Euler angles in is not stated in the installed package's types, and a wrong
 * order does not fail — it puts the ink somewhere plausible and slightly wrong.
 * If the composition ever needs to tilt, the order gets confirmed on a device
 * first and this function grows a test for it.
 */
export function xrSurfaceLocal(
  world: readonly [number, number, number],
  position: XrVector3,
  yawDeg: number,
  scale: number,
): { x: number; y: number } {
  const dx = world[0] - position[0];
  const dy = world[1] - position[1];
  const dz = world[2] - position[2];
  const yaw = (yawDeg * Math.PI) / 180;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return {
    x: (dx * cos - dz * sin) / scale,
    y: dy / scale,
  };
}
