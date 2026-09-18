// Where the composition goes when the child arrives, and when they ask for it
// back — computed from the head the renderer reports, never from a constant.
//
// WHY A CONSTANT WAS ALWAYS WRONG HERE, and it took a headset to see it. The
// board opened at `[0, -0.1, -1.5]`, written as "a little below the eye line,
// a metre and a half out". That sentence is only true if the scene's origin is
// the head. On a PICO the runtime hands the renderer a FLOOR-referenced origin,
// so the same numbers put the whole composition 10 cm above the floor — the
// board, the rail and Natalie were at the child's feet, and the copy above them
// still said they were in front of the child.
//
// The fix is not a height to subtract. A room-scale runtime knows where the
// head is and says so every frame (`ViroARScene.onCameraTransformUpdate`), so
// the placement is derived from that pose and is correct under either origin,
// at any height, seated or standing, for a child or an adult. A magic 1.6 would
// have been right for exactly one body in exactly one posture.
//
// FLATTENED, NOT COPIED. The board is placed along where the child is FACING,
// not along where they are looking: taking the camera's forward whole would
// pitch the composition to wherever their chin happened to be and hang the
// paper in the air or bury it in the floor. The forward is projected onto the
// horizontal plane, the drop below eye level is the composition's own token,
// and the board stays upright.
// SOT: packages/ui/xr/surface-drag.ts · packages/app/features/tutor/tutor-xr-screen.native.tsx
// SOT-KEYWORDS: xr board placement camera transform head pose recenter yaw facing floor origin stage

import type { XrPlacement, XrVector3 } from './XrPanel.types.ts';

/** The head, as the renderer reports it. `ViroCameraTransform`'s two useful halves. */
export interface XrHeadPose {
  position: XrVector3;
  /** Unit vector the head is looking along. `-Z` when the child faces forward. */
  forward: XrVector3;
}

export interface XrPlaceInput {
  /** How far in front of the child the board's anchor sits, in metres. */
  distanceM: number;
  /** How far below eye level the anchor is dropped, in metres. Positive is down. */
  dropM: number;
}

/**
 * The placement that puts the board in front of the child, facing them.
 *
 * THE YAW IS THE HALF THAT CANNOT BE EYEBALLED. A quad with no rotation has its
 * surface normal along `+Z` (`xrDragPlane` builds the facing normal as
 * `[sinθ, 0, cosθ]`, which is that vector turned), so to face a child standing
 * at `C` the board at `B` needs its normal along `C − B`. With `B = C + f·d`
 * that is `−f`, giving `sinθ = −fx`, `cosθ = −fz`, `θ = atan2(−fx, −fz)`. A
 * child facing world `−Z` gets `θ = 0` — the placement this feature shipped
 * with — which is why the error stayed invisible in a room where everyone
 * happened to start facing the same way.
 *
 * A head pose with no horizontal component — a child looking straight up or
 * straight down as the scene opens — cannot say which way they are facing, so
 * the board keeps the yaw it would have had facing world `−Z` rather than
 * spinning to a direction the arithmetic invented.
 */
export function placeInFrontOf(pose: XrHeadPose, { distanceM, dropM }: XrPlaceInput): XrPlacement {
  const [px, py, pz] = pose.position;
  const [fx, , fz] = pose.forward;

  // A non-finite pose would put the whole composition somewhere unrelated to
  // the child, so it is refused here rather than rendered — the rule
  // `layoutBoard` and `xrDragPlane` already follow.
  if (![px, py, pz, fx, fz].every(Number.isFinite)) {
    throw new RangeError('placeInFrontOf: non-finite head pose');
  }

  const flat = Math.hypot(fx, fz);
  const [dirX, dirZ] = flat > 1e-6 ? [fx / flat, fz / flat] : [0, -1];

  return {
    position: [px + dirX * distanceM, py - dropM, pz + dirZ * distanceM],
    rotation: [0, (Math.atan2(-dirX, -dirZ) * 180) / Math.PI, 0],
    scale: 1,
  };
}
