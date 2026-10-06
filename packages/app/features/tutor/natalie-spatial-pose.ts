// Natalie's idle body, as bone world matrices — the spatial renderer's half of
// the performance the 2D stage plays through three.js.
//
// THE SAME ENGINE, A DIFFERENT WRITER. On the 2D stage `applyBodyFrame` writes
// `IdleEngine`'s channels onto three.js bones every frame. ViroCore has no JS
// bone objects — the moyo.2 fork exposes `setSkeletonBoneTransforms(names,
// matrices, recurse)`, world matrices with children carried along — so this
// module turns the SAME channels into those matrices. One idle model, two
// writers, and this one is pure so the mapping is a test rather than a thing
// to squint at through a headset.
//
// WHAT IT DRIVES, AND WHY ONLY THIS. Four controls of the Rigify rig: `torso`
// (breath lift + weight sway, as translation), `chest` (breath pitch), `neck`
// and `head` (drift + nod, split 40/60 — the same distribution `body-frame.ts`
// uses, because one number disagreeing between the two writers is a different
// Natalie in the headset than on the laptop). Feet, wrists and fingers are
// sub-centimetre motions at 1.5 m and each would double the per-frame payload;
// they are omitted, not forgotten.
//
// ROTATIONS HAPPEN ABOUT THE BONE'S OWN REST POSITION. A world matrix rotated
// in place spins the bone about the MODEL origin — her feet — which turns a
// 2° head drift into the whole skeleton sweeping like a windscreen wiper. The
// conjugation T(p)·R·T(−p) is the entire trick in this file.
// SOT: packages/avatar/src/body-frame.ts · packages/app/features/tutor/XrNatalie.native.tsx
// SOT-KEYWORDS: natalie spatial pose bone world matrix idle breath sway neck head split viro

/** Column-major 4×4, the layout `VROMatrix4f` and the bridge speak. */
export type Mat4 = readonly number[];

/*
  Length-checked indexing, once. `noUncheckedIndexedAccess` is right about
  arbitrary arrays and wrong about these: every entry point below validates
  length before indexing, so the cast is the assertion made readable rather
  than sixteen `?? 0`s that would silently paper over a real short array.
*/
const at = (m: Mat4, i: number): number => m[i] as number;

/** The idle channels this writer reads. Structural, so `IdleFrame` satisfies it. */
export interface SpatialIdleView {
  breathY: number;
  breathPitch: number;
  swayX: number;
  swayY: number;
  driftYaw: number;
  driftPitch: number;
  nodPitch: number;
}

/*
  The bones this writer owns, in the order the payload is packed.

  They are DEFORM bones, not the Rigify control names the list carried before:
  `VROGetSkeleton` resolves names against the glTF skin's joint table, which
  holds `DEF-*` entries only — asking for `torso`/`chest`/`neck`/`head` returned
  empty matrices, so the rest-pose read could never prove out and the body
  drive never ran. The DEF spine chain maps the same way: `DEF-spine` is the
  pelvis the sway translates, `.003` is the chest, `.005` the neck, `.006` the
  head. The upper arms are in the list so `withArmsDown` can leave the loaded
  T-pose — the GLB's node rest pose, not its bind pose, which has the arms
  already at her sides.
*/
export const SPATIAL_POSE_BONES = [
  'DEF-spine',
  'DEF-spine.003',
  'DEF-spine.005',
  'DEF-spine.006',
  'DEF-upper_arm.L',
  'DEF-upper_arm.R',
] as const;

/** The neck/head share of one rotation — `body-frame.ts`'s numbers, restated. */
const NECK_SHARE = 0.4;
const HEAD_SHARE = 0.6;

const IDENTITY: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** a·b for column-major 4×4 (b applied first). */
export function mat4Multiply(a: Mat4, b: Mat4): number[] {
  const out = new Array<number>(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      out[col * 4 + row] =
        at(a, row) * at(b, col * 4) +
        at(a, 4 + row) * at(b, col * 4 + 1) +
        at(a, 8 + row) * at(b, col * 4 + 2) +
        at(a, 12 + row) * at(b, col * 4 + 3);
    }
  }
  return out;
}

/** Rotation about X then Y (the only two axes idle motion uses), radians. */
function rotationXY(pitch: number, yaw: number): Mat4 {
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  /* R = Ry·Rx, column-major. */
  return [cy, 0, -sy, 0, sy * sp, cp, cy * sp, 0, sy * cp, -sp, cy * cp, 0, 0, 0, 0, 1];
}

/** Rotation about the world Z axis — the axis that lowers a T-posed arm. */
function rotationZ(rad: number): Mat4 {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

/** T(p)·R·T(−p)·M — rotate a world matrix about its own translation. */
function rotateAbout(world: Mat4, rotation: Mat4): number[] {
  const px = at(world, 12);
  const py = at(world, 13);
  const pz = at(world, 14);
  const rotated = mat4Multiply(rotation, translate(world, -px, -py, -pz));
  return translate(rotated, px, py, pz);
}

function translate(m: Mat4, x: number, y: number, z: number): number[] {
  const out = m.slice() as number[];
  out[12] = at(out, 12) + x;
  out[13] = at(out, 13) + y;
  out[14] = at(out, 14) + z;
  return out;
}

/**
 * The frame's pose, packed for one `setSkeletonBoneTransforms` call.
 *
 * `rest` is the four bones' world matrices as the model loaded — read once via
 * `getSkeletonBoneTransforms` — packed 16 floats per bone in
 * `SPATIAL_POSE_BONES` order. The return is the same shape. Deltas always
 * compose against REST, never against the previous frame: an incremental
 * writer accumulates float error into a slow lean, and the engine's channels
 * are already absolute.
 */
export function spatialPose(rest: Mat4, frame: SpatialIdleView): number[] {
  if (rest.length !== SPATIAL_POSE_BONES.length * 16) {
    throw new RangeError('spatialPose: rest must hold 16 floats per pose bone');
  }
  /* Every bone is written — the arm entries (and any future static bones) ride
     the rest pose unchanged rather than leaving holes in the payload. */
  const out = rest.slice() as number[];

  const bone = (index: number): Mat4 => rest.slice(index * 16, index * 16 + 16);
  const write = (index: number, m: readonly number[]) => {
    for (let i = 0; i < 16; i++) out[index * 16 + i] = at(m, i);
  };

  /* torso: breath lift and weight sway are translations of the whole trunk. */
  write(0, translate(bone(0), frame.swayX, frame.breathY, frame.swayY));

  /* chest: the breath's pitch, alone — sway already arrived via the torso. */
  write(1, rotateAbout(bone(1), rotationXY(frame.breathPitch, 0)));

  /* neck and head: one gaze rotation, split 40/60 like the 2D writer. */
  const yaw = frame.driftYaw;
  const pitch = frame.driftPitch + frame.nodPitch;
  write(2, rotateAbout(bone(2), rotationXY(pitch * NECK_SHARE, yaw * NECK_SHARE)));
  write(3, rotateAbout(bone(3), rotationXY(pitch * HEAD_SHARE, yaw * HEAD_SHARE)));

  return out;
}

/*
  How far the loaded T-pose drops to a natural hang, in radians — 68° off
  horizontal leaves a soft bend at the shoulder rather than a plumb arm glued
  to her side. Mirrored across the body: the left arm extends +X, the right −X.
*/
export const ARM_DROP_RAD = (68 * Math.PI) / 180;
const ARM_LEFT_INDEX = 4;
const ARM_RIGHT_INDEX = 5;

/**
 * The rest payload with the T-pose corrected — call it ONCE on the matrices
 * `getSkeletonBoneTransforms` returns, before handing them to `spatialPose`.
 * The model's node rest pose holds both arms straight out (what the headset
 * renders without bone writes); the GLB's skin bind pose has them down. A
 * fixed world-Z rotation about each shoulder's rest position closes the gap —
 * children (forearm, hand, fingers) follow the write because the native call
 * recurses.
 */
export function withArmsDown(rest: Mat4): number[] {
  if (rest.length !== SPATIAL_POSE_BONES.length * 16) {
    throw new RangeError('withArmsDown: rest must hold 16 floats per pose bone');
  }
  const out = rest.slice() as number[];
  const corrected = (index: number, rad: number) => {
    const m = rotateAbout(rest.slice(index * 16, index * 16 + 16), rotationZ(rad));
    for (let i = 0; i < 16; i++) out[index * 16 + i] = at(m, i);
  };
  corrected(ARM_LEFT_INDEX, -ARM_DROP_RAD);
  corrected(ARM_RIGHT_INDEX, ARM_DROP_RAD);
  return out;
}

/** A rest payload that renders the loaded pose unchanged — for tests. */
export function identityRest(): number[] {
  const out: number[] = [];
  for (let i = 0; i < SPATIAL_POSE_BONES.length; i++) out.push(...IDENTITY);
  return out;
}
