// Where a head-relative slot lands in the room.
//
// EXTRACTED SO TWO SURFACES CANNOT DISAGREE. `XrTriPanel` places the three
// panels from this; `XrBoardSurface` places the pointer quad over the centre
// one from the same call. When the arithmetic lived inside the panel component,
// the only way for the surface to find the board was to restate it — and a
// restated transform is ink at a plausible, slightly wrong place, which is the
// exact failure ADR-117 already paid for once.
//
// THE ROTATION CONVENTION IS ViroCore's, not a guess: `[sin, 0, cos]` read off
// `VROMatrix4f::rotateY`, the same column `xrDragPlane` builds its normal from.
// The two possible sign conventions differ only for a turned board, and both
// look reasonable in a screenshot, so they are not chosen by eye.
// SOT: packages/ui/xr/premium/spatialTokens.ts · packages/ui/xr/surface-drag.ts
// SOT-KEYWORDS: xr world slot head relative arc yaw rotate placement centre panel

import { SLOTS, type PanelSlot } from './premium/spatialTokens.ts';
import type { XrVector3 } from './XrPanel.types.ts';

export interface XrWorldPose {
  position: [number, number, number];
  /** Degrees about +Y. The slot's own facing, turned by the child's. */
  yaw: number;
}

/** Turn a panel-local offset by `yawDeg` about +Y. No translation. */
export function xrRotateY(
  offset: readonly [number, number, number],
  yawDeg: number,
): [number, number, number] {
  const t = (yawDeg * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const [x, y, z] = offset;
  return [x * cos + z * sin, y, -x * sin + z * cos];
}

/** A head-local slot offset, turned by the child's yaw and put in world space. */
export function worldSlot(slot: PanelSlot, head: XrVector3, yawDeg: number): XrWorldPose {
  const { position, yaw } = SLOTS[slot];
  const [x, y, z] = xrRotateY(position, yawDeg);
  return { position: [head[0] + x, head[1] + y, head[2] + z], yaw: yaw + yawDeg };
}
