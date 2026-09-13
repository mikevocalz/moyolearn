// The mapping a ray on the paper draws through, and the fixture that catches it
// when it stops holding.
//
// `WhiteboardHandle.injectPointer` is documented in the engine's CLIENT space
// and the spatial renderer reads the document in PAGE space, and those are the
// same space only while the engine's camera sits at its default. Nothing in the
// running app can see that: the ink still appears, the diff still arrives, the
// export still succeeds — it is just in the wrong place. `calibrate` measures it
// at runtime; this pins the half of the check that is pure arithmetic, so a
// runtime pass means the mapping is right rather than meaning the fixture was
// too forgiving to notice.
//
// The engine's transform is quoted, not imported: `screenToPage` is
// `x / camera.z - camera.x` in `board-html.generated.js`, inside an IIFE with no
// export. Copying the formula is the only way to assert what a moved camera
// would do to this fixture, and if a vendor bump changes it, the runtime probe
// is the thing that reports it.
// SOT: packages/ui/whiteboard.types.ts · node_modules/@quickdrawjs/react-native/src/board-html.generated.js
// SOT-KEYWORDS: whiteboard calibration mapping page client camera fixture drift tolerance xr injectPointer test

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  WHITEBOARD_CALIBRATION_FIXTURE,
  WHITEBOARD_CALIBRATION_TOLERANCE_PX,
  whiteboardPageDrift,
  whiteboardPagePoint,
} from '../whiteboard.types.ts';
import { boardSurfacePixels } from './spatial-tokens.ts';

/** The engine's own client-to-page transform, for a camera other than the pinned one. */
const screenToPage = (
  point: { x: number; y: number },
  camera: { x: number; y: number; z: number },
) => ({ x: point.x / camera.z - camera.x, y: point.y / camera.z - camera.y });

const PINNED = { x: 0, y: 0, z: 1 } as const;

test('the mapping is the multiply and nothing else, because the camera is pinned', () => {
  for (const [u, v] of WHITEBOARD_CALIBRATION_FIXTURE) {
    const predicted = whiteboardPagePoint(u, v, boardSurfacePixels);
    // What the spatial screen sends as client space, verbatim.
    const client = { x: u * boardSurfacePixels.width, y: v * boardSurfacePixels.height };
    assert.deepEqual(predicted, client);
    // And what the engine makes of it at the camera the board is held at.
    assert.deepEqual(screenToPage(client, PINNED), predicted);
  }
});

test('the corners of the surface are the corners of the page rectangle', () => {
  assert.deepEqual(whiteboardPagePoint(0, 0, boardSurfacePixels), { x: 0, y: 0 });
  assert.deepEqual(whiteboardPagePoint(1, 1, boardSurfacePixels), {
    x: boardSurfacePixels.width,
    y: boardSurfacePixels.height,
  });
});

test('the fixture is four points on the paper, and none of them share an axis', () => {
  assert.equal(WHITEBOARD_CALIBRATION_FIXTURE.length, 4);
  for (const [u, v] of WHITEBOARD_CALIBRATION_FIXTURE) {
    assert.ok(u > 0 && u < 1, `u ${u} is off the paper`);
    assert.ok(v > 0 && v < 1, `v ${v} is off the paper`);
  }
  const us = new Set(WHITEBOARD_CALIBRATION_FIXTURE.map(([u]) => u));
  const vs = new Set(WHITEBOARD_CALIBRATION_FIXTURE.map(([, v]) => v));
  assert.equal(us.size, 4, 'two points share a u, so a y-only error could hide');
  assert.equal(vs.size, 4, 'two points share a v, so an x-only error could hide');
});

/*
  The symmetry cases are the reason the fixture is not the obvious square. Each
  of these is a mapping that is wrong in a way a still screenshot cannot show —
  ink that tracks the ray but mirrors it, or swaps its axes — and each has to
  move at least one fixture point further than the tolerance.
*/
test('a transposed, mirrored or flipped mapping cannot pass', () => {
  const wrong = {
    transposed: (p: { x: number; y: number }) => ({ x: p.y, y: p.x }),
    mirroredX: (p: { x: number; y: number }) => ({ x: boardSurfacePixels.width - p.x, y: p.y }),
    mirroredY: (p: { x: number; y: number }) => ({ x: p.x, y: boardSurfacePixels.height - p.y }),
  };

  for (const [name, bend] of Object.entries(wrong)) {
    const worst = Math.max(
      ...WHITEBOARD_CALIBRATION_FIXTURE.map(([u, v]) => {
        const predicted = whiteboardPagePoint(u, v, boardSurfacePixels);
        return whiteboardPageDrift(predicted, bend(predicted));
      }),
    );
    assert.ok(
      worst > WHITEBOARD_CALIBRATION_TOLERANCE_PX,
      `${name} drifts only ${worst}px — inside the tolerance, so it would pass`,
    );
  }
});

/*
  The failure the whole mechanism exists for: `init` with a snapshot, or a
  `loadSnapshot` without `fit: false`, leaves the camera wherever `fitContent`
  put it. These are the shapes that produces — a zoom, an offset, and the two
  together — and every one of them has to be caught.
*/
test('a camera the board was not pinned at is caught, at every plausible size', () => {
  const moved = [
    { x: 0, y: 0, z: 1.25 },
    { x: 0, y: 0, z: 0.8 },
    { x: -40, y: 12, z: 1 },
    { x: 120, y: -300, z: 0.42 },
  ];

  for (const camera of moved) {
    const worst = Math.max(
      ...WHITEBOARD_CALIBRATION_FIXTURE.map(([u, v]) => {
        const predicted = whiteboardPagePoint(u, v, boardSurfacePixels);
        return whiteboardPageDrift(predicted, screenToPage(predicted, camera));
      }),
    );
    assert.ok(
      worst > WHITEBOARD_CALIBRATION_TOLERANCE_PX,
      `camera ${JSON.stringify(camera)} drifts only ${worst}px`,
    );
  }
});

/*
  A tolerance wide enough to swallow the gap between two fixture points would
  let a permutation of them pass — every point landing on a neighbour's place
  and the check still reporting a match. This is the margin that cannot close.
*/
test('the tolerance is far inside the closest pair of fixture points', () => {
  const page = WHITEBOARD_CALIBRATION_FIXTURE.map(([u, v]) =>
    whiteboardPagePoint(u, v, boardSurfacePixels),
  );
  let closest = Infinity;
  for (let a = 0; a < page.length; a += 1) {
    for (let b = a + 1; b < page.length; b += 1) {
      closest = Math.min(closest, whiteboardPageDrift(page[a], page[b]));
    }
  }
  assert.ok(
    closest > WHITEBOARD_CALIBRATION_TOLERANCE_PX * 10,
    `closest pair is ${closest}px apart, too near a ${WHITEBOARD_CALIBRATION_TOLERANCE_PX}px tolerance`,
  );
});

/*
  The tolerance's own floor. `PointerEvent`'s init dictionary types `clientX` as
  an integer in UI Events, so a fractional client coordinate can reach the engine
  truncated — sub-pixel error that is not a fault and must not be reported as
  one.
*/
test('truncating a fractional client coordinate stays a pass', () => {
  for (const [u, v] of WHITEBOARD_CALIBRATION_FIXTURE) {
    const predicted = whiteboardPagePoint(u, v, boardSurfacePixels);
    const truncated = { x: Math.trunc(predicted.x), y: Math.trunc(predicted.y) };
    assert.ok(
      whiteboardPageDrift(predicted, truncated) <= WHITEBOARD_CALIBRATION_TOLERANCE_PX,
      `truncation alone fails the fixture at (${u}, ${v})`,
    );
  }
});
