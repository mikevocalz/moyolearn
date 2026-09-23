// The arc's placement arithmetic, pinned — because a headset cannot show it is wrong.
//
// The failure mode this guards is the one ADR-117 already paid for: a slot that
// is off by a rotation still puts three panels in front of a child, in roughly
// the right shape, facing roughly the right way. Nothing throws. The only
// symptom is ink landing where the child did not aim, because the pointer plane
// and the visible board were turned by different conventions.
//
// So the two properties that actually matter are asserted rather than eyeballed:
// the arc is centred on the head at any height, and the whole composition turns
// WITH the child rather than against them.
// SOT: packages/ui/xr/world-slot.ts · packages/ui/xr/premium/spatialTokens.ts
// SOT-KEYWORDS: xr world slot test arc head relative yaw rotation eye level floor

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { worldSlot, xrRotateY } from './world-slot.ts';
import { SLOTS } from './premium/spatialTokens.ts';

const near = (a: number, b: number, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) < eps, `${a} !== ${b}`);

test('a zero yaw at the origin is the slot table itself', () => {
  for (const slot of ['left', 'center', 'right'] as const) {
    const pose = worldSlot(slot, [0, 0, 0], 0);
    pose.position.forEach((v, i) => near(v, SLOTS[slot].position[i]));
    near(pose.yaw, SLOTS[slot].yaw);
  }
});

test('the arc rides the head, so eye level holds standing or seated', () => {
  /* The bug that put the board on the floor four sessions running: a
     head-relative offset used as a world position. Every slot must translate. */
  const head: [number, number, number] = [1.2, 1.65, -0.4];
  for (const slot of ['left', 'center', 'right'] as const) {
    const pose = worldSlot(slot, head, 0);
    near(pose.position[1], head[1] + SLOTS[slot].position[1]);
    near(pose.position[1] - head[1], -0.1);
  }
});

test('the composition turns with the child, not against them', () => {
  /* Facing +90 deg puts the centre panel on the child's -X, not their +X. A
     sign flip here reads as "the panels ran away behind me". */
  const centre = worldSlot('center', [0, 0, 0], 90);
  near(centre.position[0], -2.6, 1e-9);
  near(centre.position[2], 0, 1e-9);
  near(centre.yaw, 90);
});

test('the centre slot is flat on to the child at any yaw', () => {
  for (const yaw of [-180, -73, 0, 34, 180]) {
    const centre = worldSlot('center', [0, 1.6, 0], yaw);
    /* Panel yaw equals head yaw: the board never toes in. That is what lets
       `XrBoardSurface` place a plane from the head pose alone. */
    near(centre.yaw, yaw);
    /* And it stays exactly the arc's radius away, whichever way they look. */
    const dx = centre.position[0];
    const dz = centre.position[2];
    near(Math.hypot(dx, dz), 2.6, 1e-9);
  }
});

test('rotating twice by half the angle equals rotating once', () => {
  /* Composition, which is what makes it safe for `XrBoardSurface` to rotate the
     board-area offset by the slot yaw the panel was already placed with. */
  const once = xrRotateY([0.3, -0.08, 0.006], 50);
  const twice = xrRotateY(xrRotateY([0.3, -0.08, 0.006], 25), 25);
  once.forEach((v, i) => near(v, twice[i], 1e-12));
});

test('the offset a board surface uses keeps its length and its height', () => {
  /* A yaw must not scale or lift anything: the pointer quad would end up in
     front of, or above, the art it is supposed to sit on. */
  const offset: [number, number, number] = [0, -0.08, 0.006];
  for (const yaw of [0, 17, 90, 213]) {
    const [x, y, z] = xrRotateY(offset, yaw);
    near(y, offset[1]);
    near(Math.hypot(x, z), Math.hypot(offset[0], offset[2]), 1e-12);
  }
});
