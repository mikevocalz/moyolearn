// One panel, one carrier, moved by its own grip and nothing else.
//
// Every draggable XR panel in this kit sits inside a carrier node whose
// position is `base + offset`. A grip drag is report-only (the renderer moves no
// node), and the reported positions become a LIVE offset that is written to the
// carrier natively (`setNativeProps`) without a React render. Only the release
// commits that offset to React state, once, so whatever is derived from the
// panel's pose (a sibling input plane, a stylus anchor) re-derives on that one
// render and lands exactly under the paper.
//
// Rendering the scene per drag frame was the flicker: a state write per report
// re-rendered the whole Viro tree, including the Rive canvas quads.
//
// The offset belongs to the panel, not to a workspace. A panel dragged here
// never moves its neighbours.
// SOT: packages/ui/xr/use-carrier-drag.ts · packages/ui/xr/workspace-drag.ts
// SOT-KEYWORDS: xr carrier drag panel grip offset native commit release independent flicker

import type { XrVector3 } from './XrPanel.types.ts';
import { dragStep } from './workspace-drag.ts';

export const ZERO_OFFSET: XrVector3 = [0, 0, 0];

/** In-flight grab: the last grip report and the movement since grab began. */
export interface CarrierGrab {
  last: XrVector3 | null;
  live: XrVector3;
}

export function carrierGrab(): CarrierGrab {
  return { last: null, live: ZERO_OFFSET };
}

/**
 * One grip report. `moved` is false for the seeding report and for a dropped
 * tracking jump, so the caller writes nothing native for those.
 */
export function carrierDragged(grab: CarrierGrab, position: readonly number[]): { grab: CarrierGrab; moved: boolean } {
  const step = dragStep(grab.last, position);
  if (!step.delta) return { grab: { last: step.last, live: grab.live }, moved: false };
  const d = step.delta;
  return {
    grab: { last: step.last, live: [grab.live[0] + d[0], grab.live[1] + d[1], grab.live[2] + d[2]] },
    moved: true,
  };
}

export function addOffset(a: XrVector3, b: XrVector3): XrVector3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

/** Where the carrier node sits: its base pose plus the committed and live offsets. */
export function carrierPosition(base: XrVector3, committed: XrVector3, live: XrVector3 = ZERO_OFFSET): [number, number, number] {
  return [base[0] + committed[0] + live[0], base[1] + committed[1] + live[1], base[2] + committed[2] + live[2]];
}

/** The offset the release commits. `null` when the grab never moved. */
export function carrierReleased(committed: XrVector3, grab: CarrierGrab): XrVector3 | null {
  if (grab.live.every((v) => v === 0)) return null;
  return addOffset(committed, grab.live);
}
