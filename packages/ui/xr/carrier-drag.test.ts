// A panel's grip moves that panel's carrier, and the release commits once.
//
// Pins the pure half of `useCarrierDrag`: grip reports accumulate into a live
// offset, a tracking jump is dropped, a grab that never moved commits nothing,
// and the board's content anchor follows the committed carrier exactly, so ink
// lands under the ray after a move.
// SOT: packages/ui/xr/carrier-drag.ts · packages/ui/xr/use-carrier-drag.ts
// SOT-KEYWORDS: xr carrier drag test grip release commit anchor independent

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentAnchorWorld } from './board-chrome-layout.ts';
import {
  ZERO_OFFSET,
  carrierDragged,
  carrierGrab,
  carrierPosition,
  carrierReleased,
} from './carrier-drag.ts';
import { WORKSPACE_DRAG_MAX_STEP_M } from './workspace-drag.ts';

const near = (a: number, b: number, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) < eps, `${a} !== ${b}`);

test('the first report seeds and moves nothing', () => {
  const next = carrierDragged(carrierGrab(), [1, 2, 3]);
  assert.equal(next.moved, false);
  assert.deepEqual(next.grab.live, ZERO_OFFSET);
});

test('reports accumulate into the live offset', () => {
  let grab = carrierDragged(carrierGrab(), [0, 1, -2]).grab;
  let step = carrierDragged(grab, [0.1, 1, -2]);
  assert.equal(step.moved, true);
  grab = step.grab;
  step = carrierDragged(grab, [0.25, 1.05, -2.1]);
  near(step.grab.live[0], 0.25);
  near(step.grab.live[1], 0.05);
  near(step.grab.live[2], -0.1);
});

test('a tracking jump is dropped and reseeds', () => {
  let grab = carrierDragged(carrierGrab(), [0, 0, 0]).grab;
  grab = carrierDragged(grab, [0.1, 0, 0]).grab;
  const jump = carrierDragged(grab, [0.1 + WORKSPACE_DRAG_MAX_STEP_M * 2, 0, 0]);
  assert.equal(jump.moved, false);
  near(jump.grab.live[0], 0.1);
  const after = carrierDragged(jump.grab, [0.2 + WORKSPACE_DRAG_MAX_STEP_M * 2, 0, 0]);
  near(after.grab.live[0], 0.2);
});

test('a grab that never moved commits nothing', () => {
  const grab = carrierDragged(carrierGrab(), [5, 5, 5]).grab;
  assert.equal(carrierReleased([0.3, 0, 0], grab), null);
});

test('release adds the live offset to the committed one', () => {
  let grab = carrierDragged(carrierGrab(), [0, 0, 0]).grab;
  grab = carrierDragged(grab, [0.2, -0.1, 0.05]).grab;
  const committed = carrierReleased([1, 0, 0], grab);
  assert.ok(committed);
  near(committed[0], 1.2);
  near(committed[1], -0.1);
  near(committed[2], 0.05);
});

test('the carrier sits at base + committed + live', () => {
  assert.deepEqual(carrierPosition([1, 2, 3], [0.5, 0, 0], [0, 0.25, 0]), [1.5, 2.25, 3]);
  assert.deepEqual(carrierPosition([1, 2, 3], [0.5, 0, 0]), [1.5, 2, 3]);
});

test('the board input plane follows its own committed carrier, at any yaw', () => {
  for (const yaw of [0, 34, -90, 180]) {
    const slot = { position: [0.4, 1.3, -2.2] as const, yaw };
    const still = contentAnchorWorld(slot, { position: [0, 0, 0], yawDeg: 0 });
    const moved = contentAnchorWorld(slot, { position: [0.3, -0.2, 0.1], yawDeg: 0 });
    near(moved.position[0] - still.position[0], 0.3);
    near(moved.position[1] - still.position[1], -0.2);
    near(moved.position[2] - still.position[2], 0.1);
    near(moved.yawDeg, still.yawDeg);
  }
});
