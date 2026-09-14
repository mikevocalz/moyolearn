// The pointer arithmetic, pinned — because a headset cannot show it is wrong.
//
// Both functions under test fail in the same quiet way: the stroke still draws,
// with the right shape, in the wrong place. A dropped grab offset draws every
// stroke from the quad's centre; a flipped yaw term puts the whole plane
// somewhere else in the room. Neither throws, neither logs, and both look like
// tracking drift to anyone reviewing a recording. So the renderer's own
// contract is restated here as assertions: the round-trip test below IS
// `getDragPositionFixedToPlane`, and it must invert.
// SOT: packages/ui/xr/surface-drag.ts
// SOT-KEYWORDS: xr drag plane pointer hit test world space viro fixedtoplane grab offset yaw

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  xrDragHit,
  xrDragPlane,
  xrSurfaceLocal,
  type XrDragPlaneInput,
} from './surface-drag.ts';

/** The §9 board: 0.6 m wide, 6:4, 1.5 m out and dropped below the eye line. */
const board: XrDragPlaneInput = {
  position: [0, -0.1, -1.5],
  yawDeg: 0,
  scale: 1,
  offset: 0.002,
  width: 0.6,
  height: 0.4,
};

const near = (a: readonly number[], b: readonly number[], what: string) => {
  assert.equal(a.length, b.length, what);
  for (let i = 0; i < a.length; i += 1) {
    assert.ok(Math.abs(a[i] - b[i]) < 1e-9, `${what}: [${a}] vs [${b}]`);
  }
};

test('a drag that has not moved yet names the point the child grabbed', () => {
  const downHit = [0.12, -0.2, -1.498] as const;
  const atRest = [0, -0.1, -1.498] as const;
  near(xrDragHit(atRest, downHit, atRest), downHit, 'the grab point moved on its own');
});

test('the grab offset survives the drag instead of collapsing to the centre', () => {
  /*
    The child starts a stroke in the paper's bottom-left corner and moves 5 cm
    right. The centre of the quad is nowhere near either point, which is the
    whole reason `dragToPos` cannot be used as the hit.
  */
  const centre = [0, -0.1, -1.498] as const;
  const downHit = [-0.2, -0.4, -1.498] as const;
  const dragToPos = [0.05, -0.1, -1.498] as const;
  near(xrDragHit(dragToPos, downHit, centre), [-0.15, -0.4, -1.498], 'the corner grab was lost');
});

test('the reconstruction inverts the renderer, for every point on the paper', () => {
  /*
    This is `VROInputControllerBase::getDragPositionFixedToPlane` written out:
    the node is moved by the same delta the ray's plane intersection moved by.
    Feeding its output back through `xrDragHit` has to return the intersection
    the engine started from, or the ink trails the ray by a fixed offset.
  */
  const { planePoint } = xrDragPlane(board);
  const downHit = [0.2, -0.3, planePoint[2]] as const;
  const engineDrag = (intersect: readonly [number, number, number]) =>
    [
      planePoint[0] + (intersect[0] - downHit[0]),
      planePoint[1] + (intersect[1] - downHit[1]),
      planePoint[2] + (intersect[2] - downHit[2]),
    ] as const;

  for (const intersect of [
    [0.2, -0.3, planePoint[2]], // the grab point itself
    [-0.275, 0.285, planePoint[2]], // a top-left corner
    [0.275, -0.485, planePoint[2]], // a bottom-right corner
    [0, -0.1, planePoint[2]], // dead centre
  ] as const) {
    near(xrDragHit(engineDrag(intersect), downHit, planePoint), intersect, 'round trip');
  }
});

test('a board facing the child has the plane the paper is drawn on', () => {
  const plane = xrDragPlane(board);
  near(plane.planeNormal, [0, 0, 1], 'the paper stopped facing the child');
  /* The quad stands off the anchor along its own facing, never along world Z. */
  near(plane.planePoint, [0, -0.1, -1.5 + 0.002], 'the standoff went the wrong way');
});

test('yaw turns the plane with the board rather than leaving it behind', () => {
  const turned = xrDragPlane({ ...board, yawDeg: 90, offset: 0.1 });
  near(turned.planeNormal, [1, 0, 0], 'a quarter turn did not face +X');
  near(turned.planePoint, [0.1, -0.1, -1.5], 'the standoff ignored the yaw');

  const away = xrDragPlane({ ...board, yawDeg: 180, offset: 0.1 });
  near(away.planeNormal, [0, 0, -1], 'a half turn did not face -Z');
  near(away.planePoint, [0, -0.1, -1.6], 'the standoff ignored the half turn');
});

test('the scale gesture takes the standoff and the reach with it', () => {
  const half = xrDragPlane({ ...board, scale: 0.5, offset: 0.1 });
  near(half.planePoint, [0, -0.1, -1.5 + 0.05], 'the standoff was not scaled');

  const full = xrDragPlane({ ...board, offset: 0.1 });
  assert.ok(half.maxDistance < full.maxDistance, 'a smaller board still reaches as far');
});

test('every corner of the paper is inside the drag reach', () => {
  /*
    Past `maxDistance` the renderer clamps the drag onto a circle, so a corner
    outside it is a corner a child cannot draw in. Checked at both yaws, since
    the reach is measured from the head and a turned board moves its corners.
  */
  for (const yawDeg of [0, 35, 90, -60]) {
    const plane = xrDragPlane({ ...board, yawDeg });
    const yaw = (yawDeg * Math.PI) / 180;
    /* The paper's own axes in world terms: right is the normal turned 90°. */
    const right = [Math.cos(yaw), 0, -Math.sin(yaw)] as const;
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const corner = [
          plane.planePoint[0] + right[0] * sx * (board.width / 2),
          plane.planePoint[1] + sy * (board.height / 2),
          plane.planePoint[2] + right[2] * sx * (board.width / 2),
        ];
        const distance = Math.hypot(corner[0], corner[1], corner[2]);
        assert.ok(
          distance <= plane.maxDistance + 1e-9,
          `corner at ${distance} m is outside a reach of ${plane.maxDistance} m (yaw ${yawDeg})`,
        );
      }
    }
  }
});

test('the reach always clears the plane itself, so the clamp stays real', () => {
  /*
    The renderer's out-of-reach branch takes `sqrt(maxDistance² − d²)` where `d`
    is the head-to-plane distance. A reach shorter than that is a NaN position,
    which is a stroke that vanishes rather than a stroke that stops.
  */
  for (const position of [
    [0, -0.1, -1.5],
    [0, 0, -0.45],
    [0.8, 0.3, -2],
  ] as const) {
    const plane = xrDragPlane({ ...board, position });
    const toPlane = Math.abs(
      plane.planePoint[0] * plane.planeNormal[0] +
        plane.planePoint[1] * plane.planeNormal[1] +
        plane.planePoint[2] * plane.planeNormal[2],
    );
    assert.ok(plane.maxDistance > toPlane, `reach ${plane.maxDistance} under ${toPlane}`);
  }
});

test('a placement that could not be drawn on throws instead of being rendered', () => {
  const cases: [string, Partial<XrDragPlaneInput>][] = [
    ['a NaN recenter', { position: [0, Number.NaN, -1.5] }],
    ['an infinite depth', { position: [0, 0, Number.NEGATIVE_INFINITY] }],
    ['a NaN yaw', { yawDeg: Number.NaN }],
    ['a NaN scale', { scale: Number.NaN }],
    ['a NaN paper', { width: Number.NaN }],
  ];
  for (const [what, over] of cases) {
    assert.throws(() => xrDragPlane({ ...board, ...over }), RangeError, `${what} was accepted`);
  }
});

/*
  THE SIGN THAT WAS WRONG FOR AS LONG AS NOTHING TURNED. ADR-117 recorded
  `toSurfaceLocal`'s double negation as dormant — true only while every
  placement was `rotation: [0, 0, 0]`. Placement is the child's own head pose
  now and the board is turned to face them, so this is the test that had to
  arrive in the same change as the yaw.

  It is asserted as a ROUND TRIP against the forward transform the renderer
  actually applies — `x' = x·cosθ + z·sinθ`, `z' = −x·sinθ + z·cosθ`, the same
  rotation `xrDragPlane` takes the facing normal from — rather than against a
  hand-computed number, because a hand-computed number carrying the same sign
  error passes happily.
*/
test('a point on a turned board maps back to where it was drawn', () => {
  const position: [number, number, number] = [0.4, -0.1, -1.2];
  const scale = 1.3;

  for (const yawDeg of [-140, -40, 0, 25, 90, 179]) {
    const yaw = (yawDeg * Math.PI) / 180;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);

    for (const local of [
      [0, 0],
      [0.25, 0.1],
      [-0.3, -0.18],
    ] as const) {
      /* Local → world, exactly as the renderer composes it. */
      const world: [number, number, number] = [
        position[0] + (local[0] * cos) * scale,
        position[1] + local[1] * scale,
        position[2] + (-local[0] * sin) * scale,
      ];
      const back = xrSurfaceLocal(world, position, yawDeg, scale);
      assert.ok(
        Math.abs(back.x - local[0]) < 1e-12 && Math.abs(back.y - local[1]) < 1e-12,
        `yaw ${yawDeg}: (${local[0]}, ${local[1]}) came back as (${back.x}, ${back.y})`,
      );
    }
  }
});

/*
  And the failure mode the old code had, stated as its own assertion: at a
  non-zero yaw the two expressions disagree, so a test that only ever ran at
  yaw 0 could not have caught it.
*/
test('the yaw term actually moves the answer', () => {
  const position: [number, number, number] = [0, 0, -1.5];
  const world: [number, number, number] = [0.2, 0, -1.3];
  const straight = xrSurfaceLocal(world, position, 0, 1);
  const turned = xrSurfaceLocal(world, position, 35, 1);
  assert.ok(Math.abs(straight.x - turned.x) > 0.05, 'yaw made no difference to the mapping');
});
