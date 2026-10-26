// Moving the workspace with a controller grip, as one transform.
//
// The board, its ink input plane, the flanks and Natalie are all placed from
// the session `placement` (via `workspaceHeadOf` and `worldSlot`). Dragging the
// board therefore writes the placement rather than offsetting the board node:
// the input plane is computed from the same placement on the same render, so
// the paper a child sees and the plane their ray draws on cannot separate.
//
// Drag positions come from a Gizmo grip (report-only, the node is not moved
// natively). Successive reports are turned into deltas here; one oversized step
// is treated as a tracking jump and dropped instead of throwing the board
// across the room.
// SOT: packages/ui/xr/world-slot.ts · packages/app/features/tutor/tutor-xr-screen.native.tsx
// SOT-KEYWORDS: xr workspace drag placement grip gizmo delta move board ink plane

import type { XrPlacement, XrVector3 } from './XrPanel.types.ts';

/** Largest believable grip movement between two drag reports, in metres. */
export const WORKSPACE_DRAG_MAX_STEP_M = 0.5;

/** The head pose the arc is laid out from: `distanceM` back along the
    placement's yaw and `dropM` up from it. */
export function workspaceHeadOf(
  placement: Pick<XrPlacement, 'position' | 'rotation'>,
  distanceM: number,
  dropM: number,
): [number, number, number] {
  const yaw = (placement.rotation[1] * Math.PI) / 180;
  return [
    placement.position[0] + Math.sin(yaw) * distanceM,
    placement.position[1] + dropM,
    placement.position[2] + Math.cos(yaw) * distanceM,
  ];
}

/**
 * One drag report → the movement since the previous one. The first report of a
 * grab only seeds `last`. A step longer than `maxStepM` reseeds without moving.
 */
export function dragStep(
  last: XrVector3 | null,
  next: readonly number[],
  maxStepM = WORKSPACE_DRAG_MAX_STEP_M,
): { delta: XrVector3 | null; last: XrVector3 } {
  const p: XrVector3 = [next[0] ?? 0, next[1] ?? 0, next[2] ?? 0];
  if (!p.every(Number.isFinite)) return { delta: null, last: last ?? p };
  if (last === null) return { delta: null, last: p };
  const delta: XrVector3 = [p[0] - last[0], p[1] - last[1], p[2] - last[2]];
  if (Math.hypot(delta[0], delta[1], delta[2]) > maxStepM) return { delta: null, last: p };
  return { delta, last: p };
}

/** Translate a placement. Yaw and scale are kept: dragging moves, it never turns. */
export function movePlacement<T extends Pick<XrPlacement, 'position'>>(placement: T, delta: XrVector3): T {
  return {
    ...placement,
    position: [
      placement.position[0] + delta[0],
      placement.position[1] + delta[1],
      placement.position[2] + delta[2],
    ],
  };
}
