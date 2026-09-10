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

export interface Layer {
  readonly name: string;
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
    why: 'Layer one. The rest pose plus the fingers’ resting arc — the state every delta above is measured against. It is a base POSE, not a clip: neither shipped asset contains an animation, so nothing here waits on a clip library.',
  },
  {
    name: 'life',
    owns: [],
    modulates: [...SPINE.map(bone), ...ARMS.map(bone), ...FINGER_BONES],
    why: 'Breath, sway, weight shift, torso turn, shoulder and wrist drift, per-finger noise. Bounded by idleConfig; it may not reach the head chain, which belongs to cadence.',
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
export function ownershipProblems(layers: readonly Layer[] = LAYERS): OwnershipProblem[] {
  const owners = new Map<string, string[]>();
  for (const layer of layers) {
    for (const joint of layer.owns) owners.set(joint, [...(owners.get(joint) ?? []), layer.name]);
  }
  const problems: OwnershipProblem[] = [];
  for (const [joint, names] of owners) {
    if (names.length > 1) problems.push({ kind: 'double-owned', joint, layers: names });
  }
  for (const layer of layers) {
    for (const joint of layer.modulates) {
      if (!owners.has(joint)) problems.push({ kind: 'unowned', joint, layers: [layer.name] });
    }
  }
  return problems;
}
