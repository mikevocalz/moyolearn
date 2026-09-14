// The spatial pose writer, pinned — the failure class is the one every bone
// bug shares: a body that still moves, smoothly, in the wrong place.
// SOT: packages/app/features/tutor/natalie-spatial-pose.ts
// SOT-KEYWORDS: natalie spatial pose test bone matrix rotate about rest windscreen wiper

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SPATIAL_POSE_BONES,
  identityRest,
  mat4Multiply,
  spatialPose,
  type SpatialIdleView,
} from './natalie-spatial-pose.ts';

const STILL: SpatialIdleView = {
  breathY: 0,
  breathPitch: 0,
  swayX: 0,
  swayY: 0,
  driftYaw: 0,
  driftPitch: 0,
  nodPitch: 0,
};

/** A rest payload with each bone translated to a distinct position. */
function standingRest(): number[] {
  const rest = identityRest();
  const heights = [0.9, 1.2, 1.45, 1.55] as const;
  for (let i = 0; i < SPATIAL_POSE_BONES.length; i++) {
    rest[i * 16 + 13] = heights[i] ?? 0;
  }
  return rest;
}

const bone = (pose: readonly number[], index: number) => pose.slice(index * 16, index * 16 + 16);

test('a still frame returns the rest pose exactly', () => {
  const rest = standingRest();
  assert.deepEqual(spatialPose(rest, STILL), rest);
});

test('breath lifts the torso without touching the head matrix', () => {
  const rest = standingRest();
  const pose = spatialPose(rest, { ...STILL, breathY: 0.004 });
  assert.ok(Math.abs((bone(pose, 0)[13] ?? 0) - (0.9 + 0.004)) < 1e-12);
  assert.deepEqual(bone(pose, 3), bone(rest, 3), 'the head moved on a breath');
});

test('a head turn pivots about the bone, not about her feet', () => {
  /*
    The windscreen-wiper bug. Rotating the head's WORLD matrix in place spins
    it about the model origin, so a 0.1 rad drift sweeps the head through
    ~15 cm of world space. Rotated about its own rest position, the bone's
    translation must not move at all.
  */
  const rest = standingRest();
  const pose = spatialPose(rest, { ...STILL, driftYaw: 0.1 });
  const head = bone(pose, 3);
  assert.ok(Math.abs(head[12] ?? 1) < 1e-12 && Math.abs((head[13] ?? 0) - 1.55) < 1e-12);
  /* And it genuinely rotated: the basis is no longer identity. */
  assert.ok(Math.abs((head[0] ?? 1) - 1) > 1e-6, 'the head did not turn');
});

test('the neck/head split matches the 2D writer', () => {
  const rest = standingRest();
  const pose = spatialPose(rest, { ...STILL, driftYaw: 0.2 });
  /* Column-major yaw: m[0] = cos(θ·share). */
  const neckYaw = Math.acos(bone(pose, 2)[0] ?? 1);
  const headYaw = Math.acos(bone(pose, 3)[0] ?? 1);
  assert.ok(Math.abs(neckYaw - 0.2 * 0.4) < 1e-9, `neck got ${neckYaw}`);
  assert.ok(Math.abs(headYaw - 0.2 * 0.6) < 1e-9, `head got ${headYaw}`);
});

test('deltas compose against rest, never against the previous frame', () => {
  const rest = standingRest();
  const drifting = { ...STILL, driftYaw: 0.05 };
  const once = spatialPose(rest, drifting);
  let repeated: number[] = once;
  for (let i = 0; i < 200; i++) repeated = spatialPose(rest, drifting);
  assert.deepEqual(repeated, once, 'the pose accumulated across frames');
});

test('mat4Multiply agrees with hand-checked column-major composition', () => {
  /* T(1,2,3) · scale-free identity — translation lands in [12..14]. */
  const t: number[] = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 2, 3, 1];
  const r = mat4Multiply(t, t);
  assert.deepEqual(r.slice(12, 15), [2, 4, 6]);
});

test('a rest payload of the wrong shape is refused', () => {
  assert.throws(() => spatialPose([1, 0, 0], STILL), RangeError);
});
