import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOpticalPenVisual, opticalPenTriangles } from './muse-optical-visual.ts';
import type { OpticalPose } from './muse-optical-geometry.ts';

const pose: OpticalPose = { rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], translationMeters: [1, 2, -3], maxResidualMeters: 0 };
const shape = { tipMeters: [0, 0, 0] as const, tailMeters: [0, 0, 0.14] as const, barrelRadiusMeters: 0.007, rayLengthMeters: 1 };
test('proxy and ray share the measured tip and point away from the tail', () => {
  const visual = buildOpticalPenVisual(pose, shape)!;
  assert.deepEqual(visual.vertices[0], [1, 2, -3]);
  assert.deepEqual(visual.ray, [[1, 2, -3], [1, 2, -4]]);
  assert.equal(visual.vertices.length, 9);
  assert.ok(opticalPenTriangles.flat().every(i => i >= 0 && i < visual.vertices.length));
});
test('rotation and a non-origin calibrated tip transform together without Euler conversion', () => {
  const visual = buildOpticalPenVisual({ ...pose, rotation: [0, 0, 1, 0, 1, 0, -1, 0, 0] },
    { ...shape, tipMeters: [0, 0, 0.02], tailMeters: [0, 0, 0.16] })!;
  assert.ok(Math.abs(visual.ray[0][0] - 1.02) < 1e-10);
  assert.ok(Math.abs(visual.ray[1][0] - 0.02) < 1e-10);
  assert.equal(visual.ray[0][2], -3);
});
test('degenerate or absent scale cannot produce a plausible-looking proxy', () => {
  assert.equal(buildOpticalPenVisual(pose, { ...shape, tailMeters: shape.tipMeters }), null);
  assert.equal(buildOpticalPenVisual(pose, { ...shape, barrelRadiusMeters: NaN }), null);
  assert.equal(buildOpticalPenVisual(pose, { ...shape, rayLengthMeters: -1 }), null);
});
