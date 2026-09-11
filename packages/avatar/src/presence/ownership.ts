/**
 * Who is allowed to write which joint.
 *
 * Two systems writing one joint is the defect behind every artifact worth
 * naming — the shrug on every breath, the hand through the torso, the pose that
 * snaps back when a clip ends. None of them is fixed where it is seen; they are
 * fixed by deciding who owns the joint, and by making a second claim fail the
 * build instead of blending.
 *
 * TODAY THERE IS EXACTLY ONE WRITER. `HumanoPresence` restores the reference
 * pose each frame and applies local-frame deltas on top of it, and it works
 * precisely because nothing else writes a bone. This table exists so that stays
 * true by construction rather than by nobody having added a second writer yet —
 * the moment a clip, an IK solver or a gesture layer arrives, the conflict is a
 * build error at the point it is introduced rather than a visual bug found
 * three screens away.
 *
 * OWNERSHIP AND MODULATION ARE DIFFERENT PERMISSIONS, which is what lets the
 * skill's two rules coexist. An OWNER writes the joint's absolute value; a
 * MODULATOR adds a bounded delta on top. Exactly one owner per joint, any
 * number of modulators. "The clip is the base, the life layer is additive on
 * top" and "two layers claiming one joint is a build error" are then the same
 * rule read at two tiers, and the split already matches the code: restoring the
 * reference pose is the owning write, and every `pose()` call is a modulation.
 *
 * Names are derived, never retyped. `HUMANO_BONES` and `FINGER_BONES` are the
 * writer's own lists; a hand-typed name here would be a name that drifts from
 * the asset silently, and on this rig a bone that does not resolve moves
 * nothing while every test still passes.
 *
 * SOT: .claude/skills/pose-compositor/references/ownership.md · packages/avatar/rig-manifest.json
 * SOT-KEYWORDS: pose compositor joint ownership layer owner modulator deform bone conflict build error
 */

import { FINGER_BONES, HUMANO_BONES } from './humano.ts';

const bone = (key: keyof typeof HUMANO_BONES): string => HUMANO_BONES[key];

/** The spine chain, hips to head. Ordered root-first, as the writer walks it. */
const SPINE = ['torso', 'spine1', 'spine2', 'chest', 'upperChest'] as const;
const HEAD_CHAIN = ['neck', 'head'] as const;
const ARMS = [
  'shoulderL',
  'shoulderR',
  'upperArmL',
  'upperArmR',
  'foreArmL',
  'foreArmR',
  'handL',
  'handR',
] as const;
const EYES = ['eyeL', 'eyeR'] as const;

/**
 * The leg chain, named from the shipped rig rather than assumed.
 *
 * THESE WERE NOT MISSING FROM THE ASSET. The writer's bone map had no legs and
 * this table claimed 47 of 96 deform joints, which got reported as "the rig has
 * no leg bones" — a statement about the code read back as a statement about the
 * purchase. `rig-manifest.json` lists all 25 joints below the pelvis in both
 * shipped assets, and `skeletonsAgree` is true.
 *
 * `knee_share` and the `.001` twists are Rigify's distribution bones: in Blender
 * a constraint drives each from its parent, and constraints do not export. They
 * still deform skin, so they still need an owner — one that holds the base pose
 * rather than one that writes.
 */
const LEG = {
  thighL: 'DEF-thigh.L',
  thighR: 'DEF-thigh.R',
  thighTwistL: 'DEF-thigh.L.001',
  thighTwistR: 'DEF-thigh.R.001',
  shinL: 'DEF-shin.L',
  shinR: 'DEF-shin.R',
  shinTwistL: 'DEF-shin.L.001',
  shinTwistR: 'DEF-shin.R.001',
  kneeShareL: 'DEF-knee_share.L',
  kneeShareR: 'DEF-knee_share.R',
  footL: 'DEF-foot.L',
  footR: 'DEF-foot.R',
  pelvis: 'DEF-pelvis',
} as const;

/** The driven leg joints — what stance and a weight shift actually rotate. */
export const LEG_DRIVEN: readonly string[] = [
  LEG.thighL, LEG.thighR, LEG.shinL, LEG.shinR, LEG.footL, LEG.footR,
];
/** Deform joints below the pelvis that follow their parent and are never written. */
export const LEG_PASSIVE: readonly string[] = [
  LEG.thighTwistL, LEG.thighTwistR, LEG.shinTwistL, LEG.shinTwistR,
  LEG.kneeShareL, LEG.kneeShareR, LEG.pelvis,
];

export interface Layer {
  readonly name: string;
  /**
   * Set on exactly one layer. That layer owns every deform joint no other layer
   * owns — including joints nothing ever writes, which still need a decision
   * recorded against them.
   */
  readonly ownsRemainder?: boolean;
  /** Joints whose absolute value this layer writes. Exactly one layer per joint. */
  readonly owns: readonly string[];
  /** Joints this layer adds a bounded delta to. Must be owned by some layer. */
  readonly modulates: readonly string[];
  readonly why: string;
}

export const LAYERS: readonly Layer[] = [
  {
    name: 'reference-pose',
    owns: [
      ...SPINE.map(bone),
      ...HEAD_CHAIN.map(bone),
      ...ARMS.map(bone),
      ...EYES.map(bone),
      ...FINGER_BONES,
    ],
    modulates: [],
    why: 'Layer one. The rest pose plus the fingers’ resting arc — the state every delta above is measured against. It is a base POSE, not a clip: neither shipped asset contains an animation, so nothing here waits on a clip library. It owns EVERY deform joint the manifest lists, including the ones nothing writes: a joint with no owner is a joint nobody has decided about, which is how twenty-five leg bones went unnoticed.',
    ownsRemainder: true,
  },
  {
    name: 'stance',
    owns: [],
    modulates: [...LEG_DRIVEN, bone('torso'), bone('spine1'), bone('spine2')],
    why: 'Contrapposto: which leg carries the weight, and the pelvis roll, knee flexion and spinal compensation that follow from it. A posture, held, not a motion — the weight-shift layer is what moves between two of these.',
  },
  {
    name: 'life',
    owns: [],
    modulates: [...SPINE.map(bone), ...ARMS.map(bone), ...FINGER_BONES, ...LEG_DRIVEN],
    why: 'Breath, sway, weight shift, torso turn, shoulder and wrist drift, and the hand relaxation scalar. It reaches the legs because a weight shift that does not is a pelvis floating over static feet. It may not reach the head chain, which belongs to cadence.',
  },
  {
    name: 'head-cadence',
    owns: [],
    modulates: HEAD_CHAIN.map(bone),
    why: 'Gaze-follow, drift and backchannel nods on the neck and head. Split from gaze so the two compose by owning different joints rather than by agreeing on a weight.',
  },
  {
    name: 'gaze',
    owns: [],
    modulates: EYES.map(bone),
    why: 'The eye anchors. The visible eye motion is morph targets, not bone rotation; these carry position only, which is why gaze and cadence never contend.',
  },
];

/** Every joint any layer touches, deduplicated. */
export const CLAIMED_JOINTS: readonly string[] = [
  ...new Set(LAYERS.flatMap((l) => [...l.owns, ...l.modulates])),
];

export interface OwnershipProblem {
  readonly kind: 'unowned' | 'double-owned';
  readonly joint: string;
  readonly layers: readonly string[];
}

/**
 * The invariant, as a pure function so the build check and a unit test assert
 * the same thing rather than two similar things.
 */
export function ownershipProblems(
  layers: readonly Layer[] = LAYERS,
  /**
   * Every deform joint in the rig. Passed in rather than imported so this stays
   * a pure function the unit test can drive with synthetic layers — and so the
   * list comes from the generated manifest rather than a second copy here.
   */
  deformJoints: readonly string[] = [],
): OwnershipProblem[] {
  const owners = new Map<string, string[]>();
  for (const layer of layers) {
    for (const joint of layer.owns) owners.set(joint, [...(owners.get(joint) ?? []), layer.name]);
  }

  const problems: OwnershipProblem[] = [];
  const remainderLayers = layers.filter((l) => l.ownsRemainder);
  if (remainderLayers.length > 1) {
    problems.push({
      kind: 'double-owned',
      joint: '(remainder)',
      layers: remainderLayers.map((l) => l.name),
    });
  }
  /*
    The remainder layer sweeps up whatever nothing else owns. That is what makes
    "every joint has an owner" achievable without listing ninety-six names in
    this file — and it is deliberately not silent: a joint nobody writes still
    resolves to a layer whose job is to hold it at the base pose, which is a
    decision, where absence from the table was an oversight.
  */
  const remainder = remainderLayers[0];
  if (remainder) {
    for (const joint of deformJoints) {
      if (!owners.has(joint)) owners.set(joint, [remainder.name]);
    }
  }

  for (const [joint, names] of owners) {
    if (names.length > 1) problems.push({ kind: 'double-owned', joint, layers: names });
  }
  for (const layer of layers) {
    for (const joint of layer.modulates) {
      if (!owners.has(joint)) problems.push({ kind: 'unowned', joint, layers: [layer.name] });
    }
  }
  // A deform joint the table never reaches at all.
  for (const joint of deformJoints) {
    if (!owners.has(joint)) problems.push({ kind: 'unowned', joint, layers: [] });
  }
  return problems;
}
