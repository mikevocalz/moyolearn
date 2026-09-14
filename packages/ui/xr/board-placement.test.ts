// The placement arithmetic, pinned — because the headset that shows it is wrong
// shows it as "my homework is on the floor" and nothing else.
//
// The three failures this guards are all silent: a board placed at a constant
// height under a floor-referenced origin (the defect that produced this file),
// a yaw that turns the board away from the child it was placed for, and a pose
// with no horizontal component spinning the composition to an invented
// direction.
// SOT: packages/ui/xr/board-placement.ts
// SOT-KEYWORDS: xr board placement test camera head pose yaw facing recenter floor origin

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { placeInFrontOf, type XrHeadPose } from './board-placement.ts';

/** The board's own case: 1.5 m out, dropped 10 cm below the eye line. */
const at = { distanceM: 1.5, dropM: 0.1 };

/** The board's own normal, from the yaw the placement chose. */
const normalOf = (yawDeg: number) => {
  const yaw = (yawDeg * Math.PI) / 180;
  return [Math.sin(yaw), 0, Math.cos(yaw)] as const;
};

test('the board arrives in front of the head, at the head height, whatever the origin', () => {
  /*
    The same child, at the same eye height, under the two origins a runtime can
    hand the renderer: head-referenced (0) and floor-referenced (1.45). The
    board must come out 10 cm below their eyes BOTH times — under the constant
    this replaces, the second case put it 1.35 m below them, which is the floor.
  */
  for (const eyeY of [0, 1.45, 1.1]) {
    const pose: XrHeadPose = { position: [0, eyeY, 0], forward: [0, 0, -1] };
    const placement = placeInFrontOf(pose, at);
    assert.ok(Math.abs(placement.position[1] - (eyeY - 0.1)) < 1e-12, `eye ${eyeY}`);
    assert.ok(Math.abs(placement.position[2] - -1.5) < 1e-12, 'not 1.5 m out');
  }
});

test('the board faces the child, from any direction they are facing', () => {
  for (const [fx, fz] of [
    [0, -1],
    [1, 0],
    [-1, 0],
    [0, 1],
    [Math.SQRT1_2, Math.SQRT1_2],
  ] as const) {
    const pose: XrHeadPose = { position: [0.3, 1.5, -0.8], forward: [fx, 0, fz] };
    const placement = placeInFrontOf(pose, at);
    const normal = normalOf(placement.rotation[1]);

    /* The surface normal points back down the line the child is looking. */
    assert.ok(Math.abs(normal[0] - -fx) < 1e-9 && Math.abs(normal[2] - -fz) < 1e-9,
      `facing (${fx}, ${fz}) produced normal (${normal[0]}, ${normal[2]})`);

    /* And the anchor is exactly `distanceM` along that line. */
    const dx = placement.position[0] - pose.position[0];
    const dz = placement.position[2] - pose.position[2];
    assert.ok(Math.abs(Math.hypot(dx, dz) - 1.5) < 1e-9, 'not at the board distance');
  }
});

test('a pitched head still places an upright board at the right distance', () => {
  /* Looking 45° down, which is what a child does while writing. */
  const pose: XrHeadPose = { position: [0, 1.5, 0], forward: [0, -Math.SQRT1_2, -Math.SQRT1_2] };
  const placement = placeInFrontOf(pose, at);
  assert.ok(Math.abs(placement.position[1] - 1.4) < 1e-12, 'the drop followed the gaze');
  assert.ok(Math.abs(placement.position[2] - -1.5) < 1e-9, 'the distance followed the gaze');
  assert.ok(placement.rotation[0] === 0 && placement.rotation[2] === 0, 'the board tilted');
});

test('a head with no horizontal facing keeps the forward yaw rather than inventing one', () => {
  const pose: XrHeadPose = { position: [0, 1.5, 0], forward: [0, 1, 0] };
  const placement = placeInFrontOf(pose, at);
  assert.ok(Math.abs(placement.rotation[1]) < 1e-12, 'the yaw was invented');
  assert.ok(Math.abs(placement.position[2] - -1.5) < 1e-12);
});

test('a pose the renderer could not measure is refused, not rendered', () => {
  for (const pose of [
    { position: [0, Number.NaN, 0], forward: [0, 0, -1] },
    { position: [0, 0, 0], forward: [Number.POSITIVE_INFINITY, 0, -1] },
  ] as XrHeadPose[]) {
    assert.throws(() => placeInFrontOf(pose, at), RangeError);
  }
});
