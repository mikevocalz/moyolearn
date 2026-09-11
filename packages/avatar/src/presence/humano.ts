/**
 * The Humano presence driver — the per-frame writer that makes Natalie's
 * shipped marketing body look alive, with no renderer and no framework in it.
 *
 * WHY IT IS HERE AND NOT IN THE APP. `apps/web-vite`'s Chapter 05 scene already
 * drives this exact body under react-three-fiber, and the native stage has to
 * drive the same one under `react-native-webgpu`. The two differ ONLY in where
 * a frame comes from (`useFrame` vs `setAnimationLoop`) and where the mouth
 * comes from (a baked character alignment on the marketing page, live viseme
 * samples from the tutor audio queue on device). Everything between those two
 * ends — bone lookup, rest capture, idle channels, gaze, breath, beats, the
 * morph writes — is the same maths, so it is written once, here.
 *
 * The mouth is therefore an INPUT (`mouth`, 0..1 openness), not something this
 * module fetches. That is what keeps it free of an audio clock, a `fetch`, and
 * a DOM, and it is why it can be tested in Node.
 *
 * ── THE BONES THAT ACTUALLY MOVE HER (2026-09-03, measured, ADR-113) ────────
 *
 * The glTF export carries the whole Rigify hierarchy, but the SKIN is bound to
 * the `DEF-*` bones only, and in this export the control bones `head`, `neck`
 * and `chest` are NOT ancestors of any DEF bone — Blender drove the DEF chain
 * from them with constraints, and constraints do not export. So every write
 * this file used to make to `head`/`neck`/`chest` moved nothing on the phone:
 * her head never turned, never nodded, and her chest never rose. That, more
 * than any missing channel, was "she moves like a robot".
 *
 * The deforming chain is `DEF-spine` (hips) → `.001` → `.002` → `.003` (chest)
 * → `.004` → `.005` (neck) → `.006` (head). `DEF-pelvis` carries no weight at
 * all. The axes were measured from the export, not assumed (see
 * `rig-axes.test.ts`, which fails if a re-export changes them):
 *
 *   spine chain   +x pitches the head TOWARD the camera · +y yaws · +z tilts
 *   upper arm     +x swings the hand forward · +z abducts (L +, R −)
 *   forearm/hand  +x flexes
 *   shoulder      +x raises the shoulder tip
 *   finger        +x curls into the palm (z, which this used to write, splays)
 *
 * Those are LOCAL axes, and the writer applies every rotation in the bone's
 * own frame (`rest × Δ`, see `pose`). It used to add to `rotation.x/y/z`,
 * which for three's XYZ Euler is a rotation in the PARENT's frame — the same
 * thing only while the rest rotation is small, which the spine's is and the
 * arm's is not. `DEF-jaw`, `DEF-teeth.*` and `DEF-tongue.*` carry no weight in
 * this export, so the jaw is the `jawOpen` morph alone and a jaw bone is not
 * written.
 *
 * ── TWO CHAINS, ONE BODY (the eyeballs-outside-the-sockets bug) ─────────────
 *
 * The torso SKIN hangs off the DEF chain, but the eyeballs (`DEF-eye.*`), the
 * teeth, and BOTH ARMS (`ORG-shoulder.* > DEF-upper_arm.*`) hang off the
 * control chain: `torso > MCH-spine.002 > spine_fk.002 > MCH-spine.003 >
 * spine_fk.003 > ORG-spine.004 > .005 > .006 > ORG-face`. In Blender the two
 * chains are locked together by constraints; in the export they are not. So
 * turning the head skin alone left the eyeballs where the head used to be —
 * measured on the Duo as "eyelids missing skin". Every torso/head rotation is
 * therefore applied to the DEF bone AND mirrored, as the same WORLD rotation,
 * onto its twin (`TWINS`): each pair sits at the same world position with the
 * same world orientation, verified by `rig-axes.test.ts`, so identical world
 * deltas keep the skin, the eyes and the arms one body.
 *
 * SOT: packages/avatar/src/idle/engine.ts · apps/web-vite/src/components/chapters/natalie-scene.tsx
 *      docs/pack/22-embodied-tutor-avatar-spec.md §7 · docs/decisions/adr-111-native-3d-runtime.md
 *      docs/decisions/adr-113-body-motion-layer.md · ./rig-axes.test.ts
 * SOT-KEYWORDS: humano presence natalie idle morph bones gaze breath beat native web shared def spine weight shift fingers firewall a2f face emotion clip base blend layer one cross fade
 */
import * as THREE from 'three';
import { idleConfig } from '../idle/config.ts';
import { HAND_CHANNELS, IDLE_CHANNELS, IdleEngine, mulberry32, type IdleFrame, type IdleInputs } from '../idle/engine.ts';
import { DEFAULT_GESTURE_LIMITS } from '../safety/gesture-gate.ts';
import type { Shape } from '../speech/track.ts';
import type { RetargetedClip } from './clip-player.ts';

/**
 * Rigify names as authored, DEFORMING bones only (see the header). `GLTFLoader`
 * runs every node name through `PropertyBinding.sanitizeNodeName`, which strips
 * dots, so each is looked up under both spellings — see `resolveBone`.
 */
export const HUMANO_BONES = {
  /** The torso root. Translating it is the weight shift. */
  torso: 'DEF-spine',
  spine1: 'DEF-spine.001',
  spine2: 'DEF-spine.002',
  chest: 'DEF-spine.003',
  upperChest: 'DEF-spine.004',
  neck: 'DEF-spine.005',
  head: 'DEF-spine.006',
  /**
   * Position only — the gaze anchor. The eyes themselves are morphs. The
   * DEFORM eye bones, because they ride the head (through its twin chain);
   * the `eye.L` controls sit under `root` and would stay behind a turned head.
   */
  eyeL: 'DEF-eye.L',
  eyeR: 'DEF-eye.R',
  shoulderL: 'DEF-shoulder.L',
  shoulderR: 'DEF-shoulder.R',
  upperArmL: 'DEF-upper_arm.L',
  upperArmR: 'DEF-upper_arm.R',
  foreArmL: 'DEF-forearm.L',
  foreArmR: 'DEF-forearm.R',
  handL: 'DEF-hand.L',
  handR: 'DEF-hand.R',
  /*
    THE LEGS, which this map did not have and the asset always did.

    Axes measured from the shipped rig the same way the arm and spine axes
    were, not assumed from the others:

      DEF-thigh   +x extends the hip (foot travels -0.223 z), +z abducts
      DEF-shin    +x FLEXES the knee (foot -0.106 z and +0.020 y — the heel
                  rises toward the buttock), +z abducts, +y is twist
      DEF-foot    +x plantarflexes (toe -0.037 y)

    The knee and the forearm therefore share a convention: +x flexes. That is
    worth knowing and not worth relying on — `rig-axes.test.ts` asserts it, so
    a re-export that changes it turns red instead of bending her sideways.
  */
  thighL: 'DEF-thigh.L',
  thighR: 'DEF-thigh.R',
  shinL: 'DEF-shin.L',
  shinR: 'DEF-shin.R',
  footL: 'DEF-foot.L',
  footR: 'DEF-foot.R',
} as const;

/** The finger deform bones, per side, in `FINGER_CHANNELS` order. */
const FINGERS = ['thumb', 'f_index', 'f_middle', 'f_ring', 'f_pinky'] as const;
const PHALANGES = ['01', '02', '03'] as const;

/**
 * The thirty finger bone names, built once and exported so the ownership table
 * and the build check read the same list the writer resolves. A second copy of
 * this loop elsewhere is a list that drifts, which on this rig means a channel
 * that silently moves nothing.
 */
export const FINGER_BONES: readonly string[] = ['L', 'R'].flatMap((side) =>
  FINGERS.flatMap((finger) => PHALANGES.map((phalanx) => fingerBone(finger, phalanx, side as 'L' | 'R'))),
);

/** One finger bone by its parts, so no caller composes the name itself. */
export function fingerBone(
  finger: (typeof FINGERS)[number],
  phalanx: (typeof PHALANGES)[number],
  side: 'L' | 'R',
): string {
  return `DEF-${finger}.${phalanx}.${side}`;
}

/**
 * Resting curl per phalanx, in radians. A hand at rest is not flat: the
 * fingers hold a soft arc that tightens toward the tip, and the little finger
 * curls more than the index. The thumb rotates rather than curls, so it gets
 * its own, smaller number.
 */
const CURL = { '01': 0.16, '02': 0.28, '03': 0.24 } as const;
/**
 * How far the hand relaxation scalar may bend a finger past its rest curl, as a
 * fraction of that curl. At 0.35 a middle finger travels about 9 degrees at the
 * knuckle between an open hand and a fully settled one.
 */
const RELAX_RANGE = 0.35;

const CURL_BY_FINGER: Record<(typeof FINGERS)[number], number> = {
  thumb: 0.45,
  f_index: 0.8,
  f_middle: 0.95,
  f_ring: 1.1,
  f_pinky: 1.25,
};

export type HumanoBoneKey = keyof typeof HUMANO_BONES;

/**
 * The control-chain twin of each deforming spine bone — the bone the eyes,
 * teeth and arms actually hang from (see the header). Same world position and
 * orientation as its DEF bone at rest, except the hip root, whose upper-body
 * twin sits 14 cm higher (the legs hang from a different branch and must NOT
 * follow a weight shift); at the lean angles this writer uses the pivot
 * mismatch is under 3 mm.
 */
export const TWINS: Partial<Record<HumanoBoneKey, string>> = {
  torso: 'MCH-spine.002',
  spine1: 'MCH-spine.002',
  spine2: 'spine_fk.002',
  chest: 'spine_fk.003',
  upperChest: 'ORG-spine.004',
  neck: 'ORG-spine.005',
  head: 'ORG-spine.006',
};

/**
 * The retargeted-clip twin pairing: each control twin the clip data names →
 * the DEF bone whose WORLD delta it mirrors. This is the retargeter's own
 * `TWIN_OF` table (tools/retarget_staystill.mjs), duplicated because the clip
 * format does not carry it and the blend path below needs it: a twin's pose
 * at PARTIAL blend cannot be interpolated per component — it must be
 * REBUILT from the DEF bone's blended world delta (see the layer-one block).
 * Note it is not the same pairing as `TWINS` above: the writer mirrors
 * `torso` onto MCH-spine.002 because it never rotates ORG-spine, but the
 * clip data drives ORG-spine directly (the legs hang from it).
 */
const CLIP_TWIN_OF: Readonly<Record<string, string>> = {
  'ORG-spine': 'DEF-spine',
  'MCH-spine.002': 'DEF-spine.001',
  'spine_fk.002': 'DEF-spine.002',
  'spine_fk.003': 'DEF-spine.003',
  'ORG-spine.004': 'DEF-spine.004',
  'ORG-spine.005': 'DEF-spine.005',
  'ORG-spine.006': 'DEF-spine.006',
};

/**
 * Her standing pose, applied speaking or not.
 *
 * The asset ships a mannequin — arms straight down, flat against the thighs
 * (`DEF-hand.L` at x 0.158, the thigh at 0.102). Nobody stands like that, and
 * it also reads as a modelling fault: the mesh is BOUND in an A-pose (hands out
 * at x 0.516), so the shipped pose is already a ~55° arms-down deformation of
 * it and linear blend skinning drags the sleeve down until the shirt closes
 * over her forearms. A few degrees back towards the bind pose fixes both.
 *
 * Radians, and small — a stance, not a gesture. Beats and speech add on top.
 * Tune here rather than in the writer below.
 */
export const STANCE = {
  /** Away from the ribcage, ~7°. */
  armAbduct: 0.12,
  /** Forward of the side seam, ~3°. */
  armForward: 0.05,
  /**
   * Elbows at rest, ~10°, which the asymmetry below splits into roughly 8° and
   * 13°.
   *
   * It was 0.11 (~6°) and read as straight arms hanging at the sides. A relaxed
   * standing arm carries more flexion than that, and at the distance she is
   * rendered 6° is indistinguishable from locked.
   */
  elbowBend: 0.18,
  /** Shoulders drop when nobody is bracing, ~2°. */
  shoulderDrop: 0.035,
  /**
   * HOW MUCH THE TWO SIDES DIFFER. Added on the left, subtracted on the right,
   * so no joint holds the same angle as its opposite.
   *
   * Everything above was applied mirror-symmetrically. A person standing with
   * both elbows at exactly the same angle is the strongest robot cue a still
   * pose has, and it is one no amount of micro-motion can undo — the idle layer
   * moves fractions of a degree on top of whatever base pose it is handed.
   * `audit/motion/what-reads-robotic.md` names symmetry as item 11; this is its
   * postural half.
   */
  asymmetry: {
    /** ~1.7° — one arm hangs a little further from the ribcage. */
    abduct: 0.03,
    /** ~2.6° — and one elbow is more bent than the other. */
    elbow: 0.045,
    /** ~1.1° — one shoulder sits a little further forward. */
    forward: 0.02,
  },
} as const;

/**
 * The resting elbow angle for one side, stance plus that side's asymmetry.
 *
 * Exported so the writer and the tests read ONE definition. Three assertions
 * used the bare `STANCE.elbowBend` as the arms-at-rest baseline, which was
 * correct only while both elbows held the same angle — the thing that made her
 * read as a mannequin. A helper is how the baseline moves in one place.
 */
export function stanceElbow(side: 'L' | 'R'): number {
  return STANCE.elbowBend + (side === 'L' ? 1 : -1) * STANCE.asymmetry.elbow;
}

/**
 * A first-order follower with a settable time constant. Two of these carry the
 * load signal: one with a short constant so the knee arrives ahead of the
 * pelvis, one with a longer one so the shoulder counter-tilt arrives behind it.
 *
 * Named for what it follows rather than `Follower`, which this file already has
 * for the hand — that one takes a fixed constant and two arguments, and two
 * classes called the same thing in one file is the kind of collision that
 * type-checks in the wrong direction.
 */
class LoadFollower {
  value = 0;
  step(target: number, dt: number, tauS: number): void {
    this.value += (target - this.value) * (1 - Math.exp(-dt / Math.max(1e-4, tauS)));
  }
}

/** three's own sanitiser, reproduced so a lookup can try both spellings. */
export function sanitizeNodeName(name: string): string {
  return name.replace(/[.:[\]/]/g, '');
}

/**
 * Degrees of eye deflection that map to a full ARKit look morph. 5° made every
 * saccade a full-range dart; 15° keeps them subtle and leaves room for the
 * constant look-at-camera bias.
 */
export const GAZE_RANGE_DEG = 15;
const DEG = Math.PI / 180;
const smoothstep = (f: number) => {
  const t = f < 0 ? 0 : f > 1 ? 1 : f;
  return t * t * (3 - 2 * t);
};
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Turn-toward (§3.3), the SMALL-ANGLE half only: below `maxRad` a person
 * turns to face something by twisting over planted feet — the head leads,
 * the shoulders follow at a fraction, the hips stay. Past it the real
 * mechanism is a step-turn: a foot un-plants, re-plants, and the pelvis
 * comes around over the new base. That is footwork this layer does not have,
 * so a larger command CLAMPS here rather than faking the step with a hip
 * spin over planted feet — the mannequin-on-a-turntable write the stance
 * layer exists to remove. The step-turn is explicitly out of scope.
 *
 * `shares` is the fraction of the commanded yaw each joint carries at
 * settle. They sum to 1 so the head's WORLD yaw lands on the command; the
 * chest carries only `spine2 + chest` of it, which is what "shoulders
 * follow at a fraction" means, and the hips carry none, so the feet gates
 * hold by construction.
 */
export const TURN_TOWARD = {
  maxRad: 15 * DEG,
  shares: { spine2: 0.15, chest: 0.15, neck: 0.35, head: 0.35 },
} as const;

/** The twelve mouth morphs this driver writes. */
export interface LipShape {
  jawOpen: number;
  mouthClose: number;
  mouthSmileLeft: number;
  mouthSmileRight: number;
  mouthFunnel: number;
  mouthLowerDownLeft: number;
  mouthLowerDownRight: number;
  mouthUpperUpLeft: number;
  mouthUpperUpRight: number;
}

export const LIP_ZERO: Readonly<LipShape> = Object.freeze({
  jawOpen: 0,
  mouthClose: 0,
  mouthSmileLeft: 0,
  mouthSmileRight: 0,
  mouthFunnel: 0,
  mouthLowerDownLeft: 0,
  mouthLowerDownRight: 0,
  mouthUpperUpLeft: 0,
  mouthUpperUpRight: 0,
});

/**
 * One openness scalar → a whole mouth.
 *
 * `jawOpen` alone reads as a ventriloquist dummy: the lips do not part, so the
 * teeth never show and the face looks like a mask with a hinge. The lower/upper
 * lip morphs are what make an open mouth legible, and a small smile keeps her
 * warm rather than slack. Ratios are the web scene's mid-vowel shape, scaled by
 * the sampled openness rather than picked per phoneme — the device path has
 * energy, not characters.
 */
export function lipFromOpenness(openness: number): LipShape {
  const o = Math.max(0, Math.min(1, openness));
  return {
    jawOpen: 0.62 * o,
    mouthClose: 0,
    mouthSmileLeft: 0.12 * o,
    mouthSmileRight: 0.12 * o,
    mouthFunnel: 0.18 * o,
    mouthLowerDownLeft: 0.38 * o,
    mouthLowerDownRight: 0.38 * o,
    mouthUpperUpLeft: 0.22 * o,
    mouthUpperUpRight: 0.22 * o,
  };
}

/** The eight ARKit eye-look weights for a gaze direction, in radians. */
export function gazeMorphs(yaw: number, pitch: number): Record<string, number> {
  const c = (v: number) => Math.max(-1, Math.min(1, v / (GAZE_RANGE_DEG * DEG)));
  const y = c(yaw);
  const p = c(pitch);
  const up = Math.max(0, p);
  const down = Math.max(0, -p);
  return {
    eyeLookUpLeft: up,
    eyeLookUpRight: up,
    eyeLookDownLeft: down,
    eyeLookDownRight: down,
    eyeLookInLeft: Math.max(0, -y),
    eyeLookOutLeft: Math.max(0, y),
    eyeLookInRight: Math.max(0, y),
    eyeLookOutRight: Math.max(0, -y),
  };
}

export interface HumanoInput {
  /** True while she is speaking — drives beats, arm lift and the idle inputs. */
  speaking: boolean;
  /**
   * What is happening in the conversation. Optional so existing callers keep
   * working; omitted, it collapses to the old two-mode behaviour.
   */
  phase?: ConversationPhase;
  /** Mouth openness 0..1 for THIS frame, from the viseme sampler. */
  mouth: number;
  /**
   * A full audio-driven face for THIS frame (ADR-112): named ARKit weights
   * from Audio2Face, sampled on the audio clock. When present it replaces the
   * openness-derived mouth entirely — brows, lids, cheeks and corners included.
   * Blink and gaze still come from the idle engine (A2F does not animate eyes).
   */
  face?: Shape | null;
  /**
   * The tone's emotion baseline (BEAT categories → ARKit weights, already
   * eased by `EmotionState`). Merged UNDER speech by per-channel max — the
   * same rule the 2D face bus uses. Tone comes from lesson state, never from
   * the child (doc 32 §4).
   */
  emotion?: Shape | null;
  /** The learner's turn just ended — fires for one frame. */
  partnerPauseEvent?: boolean;
  /** Seconds until the scheduled onset of her next sentence; omit for none. */
  timeUntilOnset?: number;
  /** Doc 22 §7: a render mode, not a preference. No travel, no beats. */
  reducedMotion: boolean;
  /** Where the learner's eye is, so her gaze lands on it and not past it. */
  cameraPosition?: THREE.Vector3 | null;
  /**
   * Where she should FACE, in radians of yaw relative to camera-forward —
   * positive is the spine chain's +y. Small angles only: the command is
   * clamped to `TURN_TOWARD.maxRad` (see that constant for why), the torso
   * twists over planted feet, and the hips and legs never move. Omitted, she
   * faces forward and this path is bit-inert.
   */
  faceYawRad?: number;
}

export interface HumanoPresence {
  step(deltaSeconds: number, input: HumanoInput): void;
  /** Rest pose restored and morphs zeroed — the state a freeze should hold. */
  rest(): void;
  /**
   * The last frame's firewall readings, for the test that proves the body
   * layer cannot produce a forbidden read (doc 22 §7) by construction.
   */
  readonly firewall: { torsoLeanRad: number; shoulderFlexionRad: number };
  /**
   * The speech swell's current level, 0..1 — the envelope the arms and the brow
   * ride on, and what has to reach zero before the body has settled after a
   * barge-in.
   *
   * Exposed for the reason `firewall` is: the settle time is an acceptance
   * criterion and it cannot be read off the pose. Differencing a run that
   * stopped speaking against one that never spoke does not work, because the
   * two consume different draws from the shared seeded stream — speech boosts
   * the blink hazard and shortens saccade intervals — so they never reconverge.
   * Measured that way it gives a 0.275° divergence at the stop against a 0.120°
   * residual floor, with the curve non-monotonic: 130% "recovered" one second
   * in. That is the random stream wandering, not a body settling.
   *
   * This is the body half only. The audio stopping is `interruptVoiceStopMs`,
   * it lives in `tutor-audio.ts`, and it needs a device.
   */
  readonly speechEnvelope: number;
  /**
   * Layer one, swappable at runtime: a retargeted clip becomes the BASE the
   * per-frame restore returns to, for the joints the clip covers (twins
   * included) — life, stance and beat deltas compose on top exactly as they do
   * over the static rest. Joints the clip does not cover keep the static rest.
   * Entering and leaving eases over `CLIP_FADE_S` with smoothstep — never a
   * snap. `setBaseClip(null)` begins the fade back to the static rest;
   * `timeS` is the clip time the base starts sampling from, advanced by the
   * presence's own clock each `step`.
   */
  setBaseClip(clip: RetargetedClip | null, timeS?: number): void;
  /** The base blend this frame: 0 = static rest, 1 = the clip. Smoothstepped. */
  readonly clipBlend: number;
}

interface BoneRest {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  /** At rest, so a local delta can be re-expressed in world terms once. */
  worldQuaternion: THREE.Quaternion;
  worldPosition: THREE.Vector3;
  parentWorldQuaternionInverse: THREE.Quaternion;
}

/**
 * The per-bone base the restore step returns to while a clip drives. `q`/`p`
 * are OWNED, preallocated at `setBaseClip` and rewritten in place every frame
 * — the compositor's no-per-frame-allocation rule.
 */
interface ClipBaseOverride {
  q: THREE.Quaternion;
  p: THREE.Vector3;
  hasQ: boolean;
  hasP: boolean;
}

interface ClipTrack<F> {
  bone: THREE.Bone;
  frames: readonly F[];
  o: ClipBaseOverride;
  rest: BoneRest;
}

/**
 * One node of the tiny per-frame FK the clip base runs over the spine chain
 * and its control twins (see the layer-one block). `wq`/`wp` are this
 * frame's world rotation/position at the CURRENT blend; `pwq`/`pwp` the
 * parent's. All four are OWNED and rewritten in place — no per-frame
 * allocation. A node is one of three kinds: a DEF track (`o` set, `def`
 * null), a control twin (`def` set — its pose is DERIVED, never sampled),
 * or an unwritten pass-through riding at rest local (both null).
 */
interface ClipFkNode {
  bone: THREE.Bone;
  rest: BoneRest;
  o: ClipBaseOverride | null;
  def: ClipFkNode | null;
  parent: ClipFkNode | null;
  /** Static parent world, for chain tops whose ancestors nothing writes. */
  anchorQ: THREE.Quaternion | null;
  anchorP: THREE.Vector3 | null;
  wq: THREE.Quaternion;
  wp: THREE.Vector3;
  pwq: THREE.Quaternion;
  pwp: THREE.Vector3;
}

/** Entering or leaving a clip base eases over this long. Smoothstep, no snap. */
export const CLIP_FADE_S = 0.4;

interface BeatState {
  cancelled: boolean;
  refractory: number;
  quietS: number;
  voicedS: number;
  armed: boolean;
  t: number;
  dur: number;
  side: 1 | -1;
  both: boolean;
  amp: number;
}

const IDLE_QUIET: IdleInputs = {
  speechActive: false,
  speechGap: false,
  processing: false,
  partnerSpeaking: false,
  partnerPauseEvent: false,
  partnerF0Falling: false,
  timeUntilOnset: Infinity,
};

const IDLE_SPEAKING: IdleInputs = { ...IDLE_QUIET, speechActive: true };

/**
 * The conversation, as the idle engine already knew how to hear it.
 *
 *   speaking  — sound is coming out. Beats, mouth, the speech swell.
 *   thinking  — the model is composing. `processing` drives the gaze away and
 *               the small stilling that reads as "working on it".
 *   listening — the learner is typing or talking. `partnerSpeaking` is what
 *               the backchannel nods hang off; without it she stares.
 *   waiting   — a turn is finished and neither of them has moved.
 */
export type ConversationPhase = 'speaking' | 'thinking' | 'listening' | 'waiting';

function idleInputsFor(phase: ConversationPhase, input: HumanoInput): IdleInputs {
  const base: IdleInputs = (() => {
    switch (phase) {
      case 'speaking':
        return IDLE_SPEAKING;
      case 'thinking':
        // Only a scheduled audio onset can arm pre-speech anticipation.
        return { ...IDLE_QUIET, processing: true };
      case 'listening':
        return { ...IDLE_QUIET, partnerSpeaking: true };
      case 'waiting':
        return { ...IDLE_QUIET, speechGap: true };
    }
  })();
  return {
    ...base,
    partnerPauseEvent: input.partnerPauseEvent === true,
    timeUntilOnset:
      input.timeUntilOnset !== undefined && Number.isFinite(input.timeUntilOnset)
        ? input.timeUntilOnset
        : base.timeUntilOnset,
  };
}

function setMorph(mesh: THREE.SkinnedMesh, name: string, value: number): void {
  const dict = mesh.morphTargetDictionary;
  const influences = mesh.morphTargetInfluences;
  if (!dict || !influences) return;
  const index = dict[name];
  if (index === undefined) return;
  influences[index] = value;
}

function maxMorph(mesh: THREE.SkinnedMesh, name: string, value: number): void {
  const dict = mesh.morphTargetDictionary;
  const influences = mesh.morphTargetInfluences;
  if (!dict || !influences) return;
  const index = dict[name];
  if (index === undefined) return;
  const current = influences[index] ?? 0;
  if (value > current) influences[index] = value;
}

function resolveBone(scene: THREE.Object3D, name: string): THREE.Bone | null {
  const direct = scene.getObjectByName(name);
  if (direct) return direct as THREE.Bone;
  const sanitized = scene.getObjectByName(sanitizeNodeName(name));
  return sanitized ? (sanitized as THREE.Bone) : null;
}

/**
 * A lightly underdamped spring. The hands ride one of these behind the arms,
 * which is what gives a gesture its overlap and its settle: the arm stops, the
 * hand arrives a beat later and sits down past rest before it comes back.
 * Critically damped would land clean and read mechanical.
 */
class Follower {
  x = 0;
  v = 0;
  // Explicit fields: this package is typechecked with `erasableSyntaxOnly`
  // because `node --test` strips the types and cannot emit a parameter property.
  private readonly k: number;
  private readonly zeta: number;
  constructor(k: number, zeta: number) {
    this.k = k;
    this.zeta = zeta;
  }
  step(target: number, dt: number): number {
    const c = 2 * Math.sqrt(this.k) * this.zeta;
    // A 20 fps device must not turn follow-through into an unstable wrist.
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.v += (this.k * (target - this.x) - c * this.v) * h;
      this.x += this.v * h;
    }
    return this.x;
  }
  reset(): void {
    this.x = 0;
    this.v = 0;
  }
}

/**
 * The seed is fixed by default and that is deliberate: doc 22 §8's golden
 * capture is only reproducible if the idle engine replays identically, and a
 * child never sees two Natalies side by side to notice they breathe alike.
 */
export function createHumanoPresence(
  scene: THREE.Object3D,
  options: { seed?: number } = {}
): HumanoPresence {
  const meshes: THREE.SkinnedMesh[] = [];
  scene.traverse((child) => {
    const mesh = child as THREE.SkinnedMesh;
    if (mesh.isSkinnedMesh) {
      // three culls a SkinnedMesh against its BIND-pose box, so a posed body
      // disappears at the edge of frame. Same override `body.ts` makes.
      mesh.frustumCulled = false;
      meshes.push(mesh);
    }
  });

  const bones = {} as Record<HumanoBoneKey, THREE.Bone | null>;
  const rests = new Map<THREE.Bone, BoneRest>();
  scene.updateMatrixWorld(true);
  const capture = (bone: THREE.Bone) => {
    if (rests.has(bone)) return;
    const worldQuaternion = bone.getWorldQuaternion(new THREE.Quaternion());
    const parentWorldQuaternion =
      bone.parent?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion();
    rests.set(bone, {
      position: bone.position.clone(),
      quaternion: bone.quaternion.clone(),
      rotation: bone.rotation.clone(),
      scale: bone.scale.clone(),
      worldQuaternion,
      worldPosition: bone.getWorldPosition(new THREE.Vector3()),
      parentWorldQuaternionInverse: parentWorldQuaternion.invert(),
    });
  };
  const missing: string[] = [];
  for (const key of Object.keys(HUMANO_BONES) as HumanoBoneKey[]) {
    const bone = resolveBone(scene, HUMANO_BONES[key]);
    bones[key] = bone;
    if (bone) capture(bone);
    else missing.push(`${key} (${HUMANO_BONES[key]})`);
  }
  /*
    A MISSING BONE IS SILENT, AND THAT IS THE DEFECT THIS NAMES.

    `pose()` no-ops on `null`, so a skeleton whose names do not match this map
    produces a presence that resolves, steps every frame, and writes nothing —
    the mesh renders in its BIND pose. On this asset the bind pose is an A-pose
    with curled fingers, which is the "arms out at 45 degrees, elbows up, fists
    clenched" a user reported and which no error anywhere explained. Every
    individual `?.` was defensible; together they turned an asset mismatch into
    a character who looks wrong.
    Loud in development, silent in production: a warning cannot fix a shipped
    binary's asset, and the fallback — she stands in her bind pose — is still
    better than throwing a child out of a tutoring session.
  */
  if (missing.length > 0 && process.env.NODE_ENV !== 'production') {
    console.warn(
      `[humano] ${missing.length} of ${Object.keys(HUMANO_BONES).length} bones did not resolve — ` +
        'she will render in her bind pose (arms out, hands closed). ' +
        `Missing: ${missing.join(', ')}`,
    );
  }
  const twins = {} as Record<HumanoBoneKey, THREE.Bone | null>;
  for (const key of Object.keys(HUMANO_BONES) as HumanoBoneKey[]) {
    const name = TWINS[key];
    const twin = name ? resolveBone(scene, name) : null;
    twins[key] = twin;
    if (twin) capture(twin);
  }

  /*
    The finger chains, resolved once, per side and per finger so the engine's
    ten noise channels land on the ten fingers rather than on a flat list.
  */
  /*
    Leg segment lengths, measured from the rig rather than typed: the child
    bone's rest offset IS the parent segment. They drive the planted-foot
    solve below, and a typed length is a length that lies after a re-export.
  */
  /*
    Sagittal rest vectors (z forward, y up) for the three-link chain: thigh
    to knee, knee to ankle, ankle to toe. The toe matters — an ankle rotation
    arcs the toe horizontally (measured: foot +x moves the toe −0.032 z per
    0.3 rad), so a solve that only preserves foot ORIENTATION still drags the
    contact point. Read from the rig, never typed.
  */
  /*
    WORLD deltas, not parent-space offsets. A child's `.position` lives in its
    parent's frame, and the thigh's rest orientation points that frame's +y
    down the bone — so reading `.position.z/.y` as sagittal coordinates flips
    signs and the solve fights the real geometry (measured: 72 mm of toe
    travel from a solver whose maths was internally exact). The rest WORLD
    positions are what the planar model is actually about.
  */
  const worldAt = (bone: THREE.Bone | null): THREE.Vector3 =>
    bone ? bone.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3();
  const sagittalDelta = (from: THREE.Bone | null, to: THREE.Bone | null): [number, number] => {
    const d = worldAt(to).sub(worldAt(from));
    return [d.z, d.y];
  };
  const toeL = resolveBone(scene, 'DEF-toe.L');
  const toeR = resolveBone(scene, 'DEF-toe.R');
  const legChain = {
    L: {
      s1: sagittalDelta(bones.thighL, bones.shinL),
      s2: sagittalDelta(bones.shinL, bones.footL),
      s3: sagittalDelta(bones.footL, toeL),
    },
    R: {
      s1: sagittalDelta(bones.thighR, bones.shinR),
      s2: sagittalDelta(bones.shinR, bones.footR),
      s3: sagittalDelta(bones.footR, toeR),
    },
  };

  const fingers: { bone: THREE.Bone; curl: number; side: 'L' | 'R'; finger: number; phalanx: number }[] = [];
  for (const side of ['L', 'R'] as const) {
    FINGERS.forEach((finger, fi) => {
      PHALANGES.forEach((phalanx, pi) => {
        const bone = resolveBone(scene, `DEF-${finger}.${phalanx}.${side}`); // in FINGER_BONES order
        if (!bone) return;
        capture(bone);
        fingers.push({ bone, curl: CURL[phalanx] * CURL_BY_FINGER[finger], side, finger: fi, phalanx: pi });
      });
    });
  }

  const engine = new IdleEngine(options.seed ?? 12345);
  /*
    Beats draw from the SEEDED stream, not `Math.random`. The idle layer's whole
    contract is "same seed, bit-identical outputs" — that is what makes the
    golden capture (doc 22 §8) reproducible.
  */
  const rng = mulberry32((options.seed ?? 12345) ^ 0x5eed);
  const lip: LipShape = { ...LIP_ZERO };
  const beat: BeatState = { cancelled: false, refractory: 0, quietS: 1, voicedS: 0, armed: true, t: 99, dur: 0.7, side: 1, both: false, amp: 0 };
  let speechEnv = 0;
  // Fingers change their resting shape with a posture adjustment, then HOLD.
  // Ten continuously independent noise signals read as constant finger fidgeting.
  const fingerRest = new Map<THREE.Bone, { current: number; target: number }>();
  for (const f of fingers) fingerRest.set(f.bone, { current: 0, target: 0 });
  const handFollow = { L: new Follower(320, 0.55), R: new Follower(320, 0.55) };
  const handLift = { L: 0, R: 0 };
  const firewall = { torsoLeanRad: 0, shoulderFlexionRad: 0 };

  const eyeMid = new THREE.Vector3();
  const eyeOther = new THREE.Vector3();
  const toCamera = new THREE.Vector3();

  /*
    ── LAYER ONE: the clip base (pose-compositor SKILL) ──────────────────────
    The presence stays THE writer. A clip never writes a bone itself: it is
    sampled into `baseOverride`, and the restore step below restores to THAT
    pose instead of the static rest for the joints the clip covers — twins
    included, because the retargeted data carries them (clip-player.ts header).
    Everything above layer one is still an additive delta, so life, stance and
    beats compose over a moving base exactly as they composed over rest.
    The blend factor cross-fades base = slerp(rest, clip, w) on entry and exit.
  */
  const baseOverride = new Map<THREE.Bone, ClipBaseOverride>();
  let clipState: {
    fps: number;
    frames: number;
    rot: ClipTrack<readonly [number, number, number, number]>[];
    pos: ClipTrack<readonly [number, number, number]>[];
    root: ClipTrack<readonly [number, number, number]> | null;
    /** FK order: parents before children, DEF bones before their twins. */
    fk: ClipFkNode[];
    /** The same nodes by bone, for `poseBoth`'s base-frame lookups. */
    fkByBone: Map<THREE.Bone, ClipFkNode>;
  } | null = null;
  let clipTime = 0;
  let clipFade = 0;
  let clipFadeTarget = 0;
  const clipQa = new THREE.Quaternion();
  const clipQb = new THREE.Quaternion();
  const clipDelta = new THREE.Quaternion();
  const clipScratchQ = new THREE.Quaternion();

  /**
   * Restores one bone to the BASE — the clip's pose while one drives, the
   * static rest otherwise — and returns the rest it was measured against.
   */
  const restore = (bone: THREE.Bone | null): BoneRest | null => {
    if (!bone) return null;
    const rest = rests.get(bone);
    if (!rest) return null;
    const o = clipState ? baseOverride.get(bone) : undefined;
    bone.position.copy(o?.hasP ? o.p : rest.position);
    if (o?.hasQ) bone.quaternion.copy(o.q);
    else bone.rotation.copy(rest.rotation);
    bone.scale.copy(rest.scale);
    return rest;
  };
  /** The unconditional rest restore — the freeze state `rest()` holds. */
  const restoreToRest = (bone: THREE.Bone): void => {
    const rest = rests.get(bone);
    if (!rest) return;
    bone.position.copy(rest.position);
    bone.rotation.copy(rest.rotation);
    bone.scale.copy(rest.scale);
  };

  const tmpEuler = new THREE.Euler();
  const tmpQuat = new THREE.Quaternion();
  const worldDelta = new THREE.Quaternion();
  const twinQuat = new THREE.Quaternion();
  const basePInv = new THREE.Quaternion();
  const tmpVec = new THREE.Vector3();
  /**
   * Rotates a bone by (dx, dy, dz) radians in ITS OWN frame, on top of rest.
   * Every measured axis in the header is a local axis, and this is the only
   * way a local axis is what gets applied.
   */
  const pose = (bone: THREE.Bone | null, dx: number, dy: number, dz: number): BoneRest | null => {
    const r = restore(bone);
    if (!r || !bone) return null;
    tmpQuat.setFromEuler(tmpEuler.set(dx, dy, dz, 'XYZ'));
    const o = clipState ? baseOverride.get(bone) : undefined;
    // Restore-then-delta, with the CLIP as what is restored to when one drives.
    bone.quaternion.copy(o?.hasQ ? o.q : r.quaternion).multiply(tmpQuat);
    return r;
  };
  /**
   * The same pose on a DEF bone and its control twin (see the header): the
   * local delta becomes a WORLD rotation through the DEF bone's rest world
   * frame, and the twin receives that world rotation in its own parent frame.
   * `tx`/`ty` are world-space translations (the weight shift, the chest lift)
   * applied to both. Twins compose: a second call on the same twin in one
   * frame multiplies onto the first.
   */
  const poseBoth = (key: HumanoBoneKey, dx: number, dy: number, dz: number, tx = 0, ty = 0): void => {
    const bone = bones[key];
    const r = pose(bone, dx, dy, dz);
    if (!r || !bone) return;
    /*
      WHICH FRAMES THE MIRROR USES. With no clip these are the REST world
      frames, exactly as before. While a clip drives, the DEF bone's world
      orientation, both pivots and the twin's parent frame are the CLIP
      BASE's at this blend (the FK above computed them): mirroring a life
      delta about the rest axes when the spine is 10–20° into a clip pose
      sends the twin a rotation about the wrong axis and a Δp about the
      wrong pivot — measured 2.53 mm of eye drift at FULL blend on
      wei_rl_28, where the twin tracks themselves are exact and only this
      mirror was still rest-anchored.
    */
    const bw = clipState ? clipState.fkByBone.get(bone) : undefined;
    if (tx !== 0 || ty !== 0) {
      if (bw) tmpVec.set(tx, ty, 0).applyQuaternion(basePInv.copy(bw.pwq).invert());
      else tmpVec.set(tx, ty, 0).applyQuaternion(r.parentWorldQuaternionInverse);
      const ob = clipState ? baseOverride.get(bone) : undefined;
      bone.position.copy(ob?.hasP ? ob.p : r.position).add(tmpVec);
    }
    const twin = twins[key];
    if (!twin) return;
    const t = rests.get(twin);
    if (!t) return;
    const tw = clipState ? clipState.fkByBone.get(twin) : undefined;
    // Δworld = Qdef · Δlocal · Qdef⁻¹ ; twin local = Qp⁻¹ · Δworld · Qp · qrest
    const defWorldQ = bw ? bw.wq : r.worldQuaternion;
    worldDelta.copy(defWorldQ).multiply(tmpQuat).multiply(twinQuat.copy(defWorldQ).invert());
    if (tw) basePInv.copy(tw.pwq).invert();
    else basePInv.copy(t.parentWorldQuaternionInverse);
    const parentWorld = twinQuat.copy(basePInv).invert();
    const local = new THREE.Quaternion().copy(basePInv).multiply(worldDelta).multiply(parentWorld);
    // Compose onto whatever this frame already put on the twin (torso + spine1
    // share one), never onto last frame's — twins are restored with the rest.
    if (!touchedTwins.has(twin)) {
      const ot = clipState ? baseOverride.get(twin) : undefined;
      twin.quaternion.copy(ot?.hasQ ? ot.q : t.quaternion);
      twin.position.copy(ot?.hasP ? ot.p : t.position);
      touchedTwins.add(twin);
    }
    twin.quaternion.premultiply(local);
    /*
      The twin rotates about ITS pivot; the DEF bone about its own. Where the
      two pivots differ (the hip root's twin is 14 cm up) the twin also has to
      travel by what the DEF rotation would have moved its pivot — otherwise
      the eyes drift ~3 mm per weight shift. Exact, not approximate:
      Δp = Δworld·(Ptwin − Pdef) − (Ptwin − Pdef).
    */
    const offset =
      bw && tw ? tmpVec.copy(tw.wp).sub(bw.wp) : tmpVec.copy(t.worldPosition).sub(r.worldPosition);
    const moved = new THREE.Vector3().copy(offset).applyQuaternion(worldDelta).sub(offset);
    moved.x += tx;
    moved.y += ty;
    if (moved.lengthSq() > 0) {
      twin.position.add(moved.applyQuaternion(basePInv));
    }
  };
  const touchedTwins = new Set<THREE.Bone>();

  /**
   * Register (or begin leaving) the clip base. Allocation happens HERE, at the
   * transition — the per-frame path only rewrites the preallocated overrides.
   * Joints the scene cannot resolve are skipped the same way the presence's
   * own bone map skips them: silently at runtime, loudly in the clip tests.
   */
  const setBaseClip = (clip: RetargetedClip | null, timeS = 0): void => {
    if (!clip) {
      clipFadeTarget = 0;
      return;
    }
    baseOverride.clear();
    const overrideFor = (bone: THREE.Bone): ClipBaseOverride => {
      let o = baseOverride.get(bone);
      if (!o) {
        o = { q: new THREE.Quaternion(), p: new THREE.Vector3(), hasQ: false, hasP: false };
        baseOverride.set(bone, o);
      }
      return o;
    };
    /*
      TWIN TRACKS ARE NOT SAMPLED — they are REBUILT. The retargeter emits a
      control twin's local pose from the exact pivot-riding construction
      (Δworld about the DEF bone plus Δp = Δworld·(Ptwin−Pdef)−(Ptwin−Pdef)),
      and that construction does not survive per-component interpolation: a
      slerp of two local rotations with a lerp of two local translations is
      NOT the compensated pair at partial weight — the lerp draws the chord
      of the arc the pivot compensation actually travels, and the eyes
      drifted up to 1.83 mm at blend 0.5 from exactly that (worse with the
      life layer on top). So each twin named by CLIP_TWIN_OF is derived per
      frame from its DEF bone's blended WORLD delta by the FK below, which
      reproduces the retargeter's own maths at every blend weight: exact at
      w = 1 by construction, exactly rest at w = 0, and pivot-true between.
      A twin whose DEF counterpart is missing from the clip falls back to
      direct sampling — the old path, kept for malformed data.
    */
    const twinDefBones = new Map<THREE.Bone, THREE.Bone>(); // twin → DEF
    for (const twinName of Object.keys(CLIP_TWIN_OF)) {
      if (!(twinName in clip.joints) && !(sanitizeNodeName(twinName) in clip.joints)) continue;
      const twin = resolveBone(scene, twinName);
      const def = resolveBone(scene, CLIP_TWIN_OF[twinName]!);
      if (twin && def && (CLIP_TWIN_OF[twinName]! in clip.joints || sanitizeNodeName(CLIP_TWIN_OF[twinName]!) in clip.joints))
        twinDefBones.set(twin, def);
    }
    const rot: ClipTrack<readonly [number, number, number, number]>[] = [];
    for (const [name, frames] of Object.entries(clip.joints)) {
      const bone = resolveBone(scene, name);
      if (!bone) continue;
      capture(bone);
      const boneRest = rests.get(bone);
      if (!boneRest) continue;
      const o = overrideFor(bone);
      o.hasQ = true;
      o.q.copy(boneRest.quaternion);
      if (twinDefBones.has(bone)) {
        o.hasP = true; // the FK writes both halves of a twin's pose
        o.p.copy(boneRest.position);
        continue; // derived, not sampled
      }
      rot.push({ bone, frames, o, rest: boneRest });
    }
    const pos: ClipTrack<readonly [number, number, number]>[] = [];
    for (const [name, frames] of Object.entries(clip.translations)) {
      const bone = resolveBone(scene, name);
      if (!bone) continue;
      if (twinDefBones.has(bone)) continue; // derived, not sampled
      capture(bone);
      const boneRest = rests.get(bone);
      if (!boneRest) continue;
      const o = overrideFor(bone);
      o.hasP = true;
      o.p.copy(boneRest.position);
      pos.push({ bone, frames, o, rest: boneRest });
    }
    // The root track is a DELTA from rest (clip-player.ts), unlike the
    // absolute translation tracks above — blended it stays rest + Δ·w.
    const rootBone = resolveBone(scene, HUMANO_BONES.torso);
    let root: ClipTrack<readonly [number, number, number]> | null = null;
    if (rootBone) {
      capture(rootBone);
      const boneRest = rests.get(rootBone);
      if (boneRest) {
        const o = overrideFor(rootBone);
        o.hasP = true;
        o.p.copy(boneRest.position);
        root = { bone: rootBone, frames: clip.root.translation, o, rest: boneRest };
      }
    }
    /*
      The FK node set: every twin, every DEF counterpart, and the unwritten
      pass-through nodes that connect a twin to its nearest tracked ancestor
      (MCH-spine.003 sits between spine_fk.002 and spine_fk.003 and nothing
      writes it). A chain top with no tracked ancestor anchors on its rest
      parent world — everything above it is static. Built once here; the
      per-frame path only rewrites the preallocated transforms.
    */
    const fkByBone = new Map<THREE.Bone, ClipFkNode>();
    const fkNodeFor = (fkBone: THREE.Bone): ClipFkNode => {
      let node = fkByBone.get(fkBone);
      if (!node) {
        capture(fkBone);
        node = {
          bone: fkBone,
          rest: rests.get(fkBone)!,
          o: baseOverride.get(fkBone) ?? null,
          def: null,
          parent: null,
          anchorQ: null,
          anchorP: null,
          wq: new THREE.Quaternion(),
          wp: new THREE.Vector3(),
          pwq: new THREE.Quaternion(),
          pwp: new THREE.Vector3(),
        };
        fkByBone.set(fkBone, node);
      }
      return node;
    };
    for (const [twin, def] of twinDefBones) {
      fkNodeFor(def);
      fkNodeFor(twin).def = fkNodeFor(def);
    }
    for (const node of [...fkByBone.values()]) {
      let ancestor = node.bone.parent;
      const trail: THREE.Object3D[] = [];
      while (ancestor && ancestor !== scene && !fkByBone.has(ancestor as THREE.Bone)) {
        trail.push(ancestor);
        ancestor = ancestor.parent;
      }
      if (ancestor && ancestor !== scene && fkByBone.has(ancestor as THREE.Bone)) {
        let parentNode = fkByBone.get(ancestor as THREE.Bone)!;
        for (let k = trail.length - 1; k >= 0; k -= 1) {
          const through = fkNodeFor(trail[k] as THREE.Bone);
          through.parent = parentNode;
          parentNode = through;
        }
        node.parent = parentNode;
      } else {
        node.anchorQ = node.rest.parentWorldQuaternionInverse.clone().invert();
        node.anchorP = node.rest.worldPosition
          .clone()
          .sub(node.rest.position.clone().applyQuaternion(node.anchorQ));
      }
    }
    // Order by dependency: a node needs its parent's world, a twin also its
    // DEF bone's. The hierarchy is a tree, so this always terminates.
    const fk: ClipFkNode[] = [];
    const placed = new Set<ClipFkNode>();
    const pending = [...fkByBone.values()];
    while (fk.length < pending.length) {
      let advanced = false;
      for (const node of pending) {
        if (placed.has(node)) continue;
        if (node.parent && !placed.has(node.parent)) continue;
        if (node.def && !placed.has(node.def)) continue;
        fk.push(node);
        placed.add(node);
        advanced = true;
      }
      if (!advanced) break;
    }
    clipState = { fps: clip.fps, frames: clip.frames, rot, pos, root, fk, fkByBone };
    clipTime = timeS;
    clipFadeTarget = 1;
  };

  // Lead and lag on the load signal — see `LoadFollower`.
  const loadLead = new LoadFollower();
  const loadLag = new LoadFollower();
  /*
    TURN-TOWARD, the same two-follower pattern as the load: the head chain
    runs on the head's own cadence (`headFollow.tauS`, the constant that
    already times how the head trails the eyes) and the torso follows on the
    torso-turn ease (`torsoTurn.easeS`), so the head crosses any fraction of
    its travel before the chest crosses the same fraction of its own — lead
    and follow, never a rigid turntable.
  */
  const turnHead = new LoadFollower();
  const turnTorso = new LoadFollower();

  const rest = (): void => {
    for (const bone of rests.keys()) restoreToRest(bone);
    for (const mesh of meshes) mesh.morphTargetInfluences?.fill(0);
    for (const key of Object.keys(lip) as (keyof LipShape)[]) lip[key] = 0;
    speechEnv = 0;
    beat.t = 99;
    beat.cancelled = true;
    beat.refractory = 0;
    beat.quietS = 1;
    beat.voicedS = 0;
    beat.armed = true;
    handFollow.L.reset();
    handFollow.R.reset();
  };

  const step = (deltaSeconds: number, input: HumanoInput): void => {
    // A tab return or a resumed freeze can hand a delta of seconds. Clamped,
    // because the idle engine integrates and a 2s step is a lurch, not a catch-up.
    const rawDelta = Number.isFinite(deltaSeconds) ? Math.max(0, Math.min(deltaSeconds, 0.05)) : 0;
    const delta = input.reducedMotion ? 0 : rawDelta;
    const phase: ConversationPhase = input.phase ?? (input.speaking ? 'speaking' : 'waiting');
    const rm = input.reducedMotion;
    const sampled = engine.step(rawDelta, idleInputsFor(phase, input));
    const frame: IdleFrame = rm ? { ...sampled } : sampled;
    if (rm) {
      for (const channel of IDLE_CHANNELS) {
        if (channel !== 'eyeBlinkLeft' && channel !== 'eyeBlinkRight') frame[channel] = 0;
      }
      frame.weightShifted = false;
    }

    // Speech envelope: the whole-utterance swell the arms and brow ride on.
    if (!input.speaking || rm) beat.cancelled = true;
    const envTarget = input.speaking && !rm && !beat.cancelled ? 1 : 0;
    speechEnv += (envTarget - speechEnv) * (1 - Math.exp(-rawDelta * 6));

    /*
      THE MOUTH. Two sources, one rule: an A2F frame is the whole face and wins
      outright; otherwise the openness scalar is shaped into lips. Both are
      speech-driven and neither is scaled by reduced motion (doc 22 §7) — but
      a frame with no sound is a closed mouth.
    */
    const face = input.speaking ? (input.face ?? null) : null;
    const target = face || !input.speaking ? LIP_ZERO : lipFromOpenness(input.mouth);
    // Asymmetric smoothing, like real articulation: snap toward a shape
    // (~22ms), relax out of it (~60ms).
    const rise = 1 - Math.exp(-rawDelta * 45);
    const fall = 1 - Math.exp(-rawDelta * 16);
    for (const key of Object.keys(LIP_ZERO) as (keyof LipShape)[]) {
      const to = target[key];
      lip[key] += (to - lip[key]) * (to > lip[key] ? rise : fall);
    }
    /*
      Conservative phrase-onset FALLBACK, not semantic gesture generation.
      The current input only has articulation, so a sustained return after a
      gap is the evidence available. A timer may suppress a gesture, never
      cause one. Continuous phonation therefore cannot pump either arm.
      Word-aligned semantic strokes need a performance track (realism audit).
    */
    beat.refractory = Math.max(0, beat.refractory - rawDelta);
    const articulation = face ? (face.jawOpen ?? 0) : input.mouth;
    const voiced = input.speaking && Number.isFinite(articulation) && articulation > 0.08;
    if (!voiced || rm) {
      beat.quietS += rawDelta;
      beat.voicedS = 0;
      if (beat.quietS >= 0.28) beat.armed = true;
    } else {
      beat.quietS = 0;
      beat.voicedS += rawDelta;
      if (beat.armed && beat.voicedS >= 0.08) {
        beat.armed = false;
        if (beat.refractory <= 0 && beat.t >= beat.dur) {
          beat.t = 0;
          beat.cancelled = false;
          beat.dur = 0.8 + rng() * 0.4;
          beat.side = rng() < 0.5 ? 1 : -1;
          beat.both = false;
          beat.amp = 0.22 + rng() * 0.18;
          beat.refractory = beat.dur + 2 + rng() * 2;
        }
      }
    }
    if (rm) {
      beat.t = beat.dur;
      handFollow.L.reset();
      handFollow.R.reset();
    }
    if (beat.t < beat.dur) beat.t += delta;
    const beatPhase = beat.t < beat.dur ? beat.t / beat.dur : 1;
    const rawBeat =
      beatPhase >= 1
        ? 0
        : beatPhase < 0.35
          ? smoothstep(beatPhase / 0.35)
          : 1 - smoothstep((beatPhase - 0.35) / 0.65);
    const beatEnv = rawBeat * speechEnv;

    // --- gaze: bias at the camera, saccades and the gaze breaks on top.
    let gazeYaw = frame.eyeYaw + frame.gazeAwayYaw;
    let gazePitch = frame.eyePitch + frame.gazeAwayPitch;
    const anchor = bones.eyeL ?? bones.head;
    if (anchor && input.cameraPosition) {
      anchor.getWorldPosition(eyeMid);
      if (bones.eyeL && bones.eyeR) {
        bones.eyeR.getWorldPosition(eyeOther);
        eyeMid.add(eyeOther).multiplyScalar(0.5);
      }
      toCamera.copy(input.cameraPosition).sub(eyeMid);
      gazeYaw += Math.atan2(toCamera.x, toCamera.z);
      gazePitch += Math.atan2(toCamera.y, Math.hypot(toCamera.x, toCamera.z));
    }
    const gaze = gazeMorphs(gazeYaw, gazePitch);

    // --- morphs. Cleared every frame: these are absolute weights, and a stale
    // one from a previous expression would never decay on its own.
    for (const mesh of meshes) {
      mesh.morphTargetInfluences?.fill(0);
      if (face) {
        for (const [name, value] of Object.entries(face)) setMorph(mesh, name, value);
      } else {
        for (const [name, value] of Object.entries(lip)) setMorph(mesh, name, value);
      }
      // The emotion baseline sits UNDER speech by per-channel max — the same
      // merge the 2D face bus makes, so the tone reads on both surfaces.
      if (input.emotion) {
        for (const [name, value] of Object.entries(input.emotion)) maxMorph(mesh, name, value);
      }
      // Idle owns the lids and the eyes; A2F does not animate either.
      maxMorph(mesh, 'eyeBlinkLeft', frame.eyeBlinkLeft);
      maxMorph(mesh, 'eyeBlinkRight', frame.eyeBlinkRight);
      maxMorph(mesh, 'eyeWideLeft', frame.eyesWide);
      maxMorph(mesh, 'eyeWideRight', frame.eyesWide);
      for (const [name, value] of Object.entries(gaze)) setMorph(mesh, name, value);
      // Gesture and prosody move together — a beat carries a brow accent.
      maxMorph(mesh, 'browInnerUp', 0.2 * beatEnv);
    }

    // ================================ the body ================================
    /*
      LAYER ONE THIS FRAME. Advance the clip clock, ease the blend, sample the
      clip into the preallocated overrides as base = slerp(rest, clip, w), and
      write that base onto EVERY covered bone — including ones no layer above
      modulates, which would otherwise hold last frame's pose. The pose() calls
      below then restore to this base and add their deltas, so entering and
      leaving a clip moves every bone along the smoothstep, never in a snap.
    */
    if (clipState) {
      clipFade = clamp(clipFade + (clipFadeTarget > 0 ? rawDelta : -rawDelta) / CLIP_FADE_S, 0, 1);
      clipTime += rawDelta;
      if (clipFade === 0 && clipFadeTarget === 0) {
        // Faded fully back to rest: drop the clip. The overrides all equal
        // rest at w = 0, so nothing jumps when the map empties.
        clipState = null;
        baseOverride.clear();
      }
    }
    const clipW = clipState ? smoothstep(clipFade) : 0;
    if (clipState) {
      const clipFrame =
        (((clipTime * clipState.fps) % clipState.frames) + clipState.frames) % clipState.frames;
      const i0 = Math.floor(clipFrame);
      const i1 = (i0 + 1) % clipState.frames;
      const ft = clipFrame - i0;
      for (const track of clipState.rot) {
        clipQa.fromArray(track.frames[i0]!);
        clipQb.fromArray(track.frames[i1]!);
        track.o.q.copy(track.rest.quaternion).slerp(clipQa.slerp(clipQb, ft), clipW);
      }
      for (const track of clipState.pos) {
        const p0 = track.frames[i0]!;
        const p1 = track.frames[i1]!;
        const r = track.rest.position;
        track.o.p.set(
          r.x + (p0[0] + (p1[0] - p0[0]) * ft - r.x) * clipW,
          r.y + (p0[1] + (p1[1] - p0[1]) * ft - r.y) * clipW,
          r.z + (p0[2] + (p1[2] - p0[2]) * ft - r.z) * clipW,
        );
      }
      if (clipState.root) {
        const p0 = clipState.root.frames[i0]!;
        const p1 = clipState.root.frames[i1]!;
        const r = clipState.root.rest.position;
        clipState.root.o.p.set(
          r.x + (p0[0] + (p1[0] - p0[0]) * ft) * clipW,
          r.y + (p0[1] + (p1[1] - p0[1]) * ft) * clipW,
          r.z + (p0[2] + (p1[2] - p0[2]) * ft) * clipW,
        );
      }
      /*
        THE TWINS, AT THIS BLEND. Sampled DEF locals are on the overrides;
        run the mini-FK top-down: each DEF/pass-through node composes its
        world from its parent, and each twin then receives its DEF bone's
        world delta Δ(w) = W(def)·Wrest(def)⁻¹ about the CURRENT pivot —
        Wtwin = Δ·Wrest(twin), Ptwin = P(def) + Δ·(Prest(twin)−Prest(def)) —
        which is the retargeter's own twin construction evaluated at blend w
        instead of only at 1. The slerp of the DEF locals IS Δ raised to w
        (slerp(q0, D·q0, w) = D^w·q0), so deriving the twin from it keeps
        rotation and pivot translation consistent at every weight; sampling
        the twin's own tracks and lerping the translation does not, and
        measured 1.83 mm of eye drift at blend 0.5 (Finding 2, 3d18ae8).
      */
      for (const node of clipState.fk) {
        if (node.parent) {
          node.pwq.copy(node.parent.wq);
          node.pwp.copy(node.parent.wp);
        } else {
          node.pwq.copy(node.anchorQ!);
          node.pwp.copy(node.anchorP!);
        }
        if (node.def) {
          clipDelta.copy(node.def.wq).multiply(clipScratchQ.copy(node.def.rest.worldQuaternion).invert());
          node.wq.copy(clipDelta).multiply(node.rest.worldQuaternion);
          node.wp
            .copy(node.rest.worldPosition)
            .sub(node.def.rest.worldPosition)
            .applyQuaternion(clipDelta)
            .add(node.def.wp);
          const o = node.o!;
          clipScratchQ.copy(node.pwq).invert();
          o.q.copy(clipScratchQ).multiply(node.wq);
          o.p.copy(node.wp).sub(node.pwp).applyQuaternion(clipScratchQ);
        } else {
          const lq = node.o?.hasQ ? node.o.q : node.rest.quaternion;
          const lp = node.o?.hasP ? node.o.p : node.rest.position;
          node.wq.copy(node.pwq).multiply(lq);
          node.wp.copy(lp).applyQuaternion(node.pwq).add(node.pwp);
        }
      }
      for (const [clipBone, o] of baseOverride) {
        if (o.hasQ) clipBone.quaternion.copy(o.q);
        if (o.hasP) clipBone.position.copy(o.p);
      }
    }
    /*
      THE STANCE YIELDS TO THE CLIP. The ownership table's stance layer
      modulates the same knees and hips a wei clip drives through the base, and
      double-driving one joint from two systems is the artifact list's first
      entry — the knee flexing against the clip's own weight shift. So while a
      clip owns the base, the stance/load writes (weight-shift translation,
      knee split, base knee flexion, free-heel unweight) are scaled by
      1 − clipW: full at rest, zero at full clip, eased through the
      cross-fade. With no clip the scale is exactly 1 and the maths below is
      bit-identical to the clipless writer.
    */
    const stanceScale = 1 - clipW;
    /*
      WEIGHT. The torso root translates between the legs (the engine's discrete
      shift plus the continuous balance sway) and the spine leans back over the
      planted foot so the head stays near centre; the shoulders then re-level.
      `DEF-thigh.*` are not children of `DEF-spine`, so the legs stay planted
      and the hip blends across the split weights — which is what a real shift
      looks like: pelvis over feet, not feet sliding under a rigid body.
    */
    const shift = rm ? 0 : frame.weightShift * stanceScale + frame.swayX;
    /*
      THE LEGS ANSWER THE PELVIS.

      `frame.weightShift` is a lateral hip offset in metres; normalised against
      its own configured amplitude it becomes a LOAD: -1 fully on one leg, +1
      fully on the other. Everything below is driven from that one number, so
      the knees cannot disagree with where the weight actually is.

      Before this, the pelvis translated and the legs did not move at all. The
      comment here used to call that correct — `DEF-thigh.*` are not children of
      `DEF-spine`, so the legs "stay planted" — and planted they were, but a hip
      that travels 22 mm over a rigid pair of legs is the mannequin-on-a-turntable
      signal, not a weight shift. A real shift is a change of SUPPORT.

      The knee leads and the shoulder lags, by the seconds in the config. A
      pelvis, knee and shoulder that all start on the same frame is the seventh
      item on the reads-robotic list; the lead is anticipation and the lag is
      overlap, which is the same pair of principles the beat layer already uses.
    */
    const stance = idleConfig.body.stance;
    const load = rm ? 0 : clamp((frame.weightShift * stanceScale) / idleConfig.body.weightShift.amplitudeM, -1, 1);
    loadLead.step(load, rawDelta, stance.kneeLeadS);
    loadLag.step(load, rawDelta, stance.shoulderLagS);
    const kneeLoad = loadLead.value;
    const shoulderLoad = loadLag.value;
    /*
      TURN-TOWARD. Clamp FIRST: past `maxRad` the honest move is a step-turn
      (see the constant), so the command saturates rather than driving the
      hips. Reduced motion pins the transition and keeps the held direction —
      the followers sit AT the target, so she faces where she is asked
      without travelling. The stance rule, one layer up: pin the transition,
      not the pose (`heldFacingScale` in reduced-motion.ts).
    */
    const faceTarget = clamp(input.faceYawRad ?? 0, -TURN_TOWARD.maxRad, TURN_TOWARD.maxRad);
    if (rm) {
      turnHead.value = faceTarget;
      turnTorso.value = faceTarget;
    } else {
      turnHead.step(faceTarget, rawDelta, idleConfig.body.headFollow.tauS);
      turnTorso.step(faceTarget, rawDelta, idleConfig.body.torsoTurn.easeS);
    }
    /*
      Positive load leans toward +x. The measured spine axis puts the head at
      -x for +z, so +x is the side the LEFT bones sit on; the left knee
      straightens as the load goes positive and the right takes the flexion.
      Never the same angle on both: `kneeSplitDeg` is added on one and taken off
      the other, which is the asymmetry the whole stance rests on.
    */
    /*
      THE FEET STAY PLANTED, and that takes the whole three-link chain.

      Knee-only flexion slid the toes 106 mm (measured on the real hierarchy).
      A two-link solve — thigh counter-rotation keeping the ankle over its
      ground point, foot preserving world orientation — left 27 mm, because
      the ankle correction itself arcs the TOE. So the constraint is the toe:
      given the knee angle, Newton solves thigh and ankle so the toe's
      sagittal position equals its rest position exactly. Three iterations
      converge below a tenth of a millimetre; measured over two minutes the
      worst horizontal toe travel is skin-blend residual, not slide.

      The free heel unweights by FLEXING THE FREE KNEE MORE, not by rotating
      the foot: extra ankle rotation is exactly the toe-dragging write the
      solve exists to remove, while extra knee flexion raises the heel with
      the toe pinned — which is what a person does.
    */
    for (const side of ['L', 'R'] as const) {
      const sideSign = side === 'L' ? -1 : 1;
      const unweight = Math.max(0, (side === 'L' ? -1 : 1) * kneeLoad) * stance.freeFootPlantarDeg;
      const flexDeg =
        (stance.kneeBaseDeg + sideSign * stance.kneeBaseSplitDeg + sideSign * kneeLoad * stance.kneeSplitDeg + unweight) *
        stanceScale;
      const phi = flexDeg * DEG;
      const chain = legChain[side];
      // Rotation about +x: y' = y cosθ − z sinθ, z' = y sinθ + z cosθ.
      const rot = (v: [number, number], theta: number): [number, number] => {
        const [z, y] = v;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);
        return [y * sin + z * cos, y * cos - z * sin];
      };
      const restToe: [number, number] = [
        chain.s1[0] + chain.s2[0] + chain.s3[0],
        chain.s1[1] + chain.s2[1] + chain.s3[1],
      ];
      // Unknowns: thigh delta a (about x), ankle delta t. Knee delta is phi.
      let a = 0;
      let t = 0;
      for (let iteration = 0; iteration < 3; iteration += 1) {
        const p1 = rot(chain.s1, a);
        const p2 = rot(chain.s2, a + phi);
        const p3 = rot(chain.s3, a + phi + t);
        const fz = p1[0] + p2[0] + p3[0] - restToe[0];
        const fy = p1[1] + p2[1] + p3[1] - restToe[1];
        // d(rot(v,θ))/dθ = rot(v, θ + π/2)
        const d1 = rot(chain.s1, a + Math.PI / 2);
        const d2 = rot(chain.s2, a + phi + Math.PI / 2);
        const d3 = rot(chain.s3, a + phi + t + Math.PI / 2);
        const ja = [d1[0] + d2[0] + d3[0], d1[1] + d2[1] + d3[1]];
        const jt = [d3[0], d3[1]];
        const det = ja[0]! * jt[1]! - jt[0]! * ja[1]!;
        if (Math.abs(det) < 1e-9) break;
        a -= (fz * jt[1]! - fy * jt[0]!) / det;
        t -= (ja[0]! * fy - ja[1]! * fz) / det;
      }
      pose(side === 'L' ? bones.thighL : bones.thighR, a, 0, 0);
      pose(side === 'L' ? bones.shinL : bones.shinR, phi, 0, 0);
      pose(side === 'L' ? bones.footL : bones.footR, t, 0, 0);
    }

    touchedTwins.clear();
    for (const twin of Object.values(twins)) if (twin) restore(twin);
    // Measured: +z on DEF-spine moves the head −x. Lean back over centre.
    poseBoth('torso', 0, 0, shift * 0.96, shift, frame.swayY * 0.3);
    let leanSum = 0;
    poseBoth('spine1', 0, 0, -shift * 0.35);
    poseBoth('spine2', 0, frame.torsoYaw * 0.6 + turnTorso.value * TURN_TOWARD.shares.spine2, -shift * 0.25);
    // Breath: the chest opens BACK on the inhale (−x) and lifts.
    const chestBreath = -frame.breathY * 6;
    poseBoth('chest', chestBreath, frame.torsoYaw * 0.4 + turnTorso.value * TURN_TOWARD.shares.chest, 0, 0, frame.breathY * 0.6);
    leanSum += chestBreath;
    const upperBreath = -frame.breathY * 3;
    poseBoth('upperChest', upperBreath, 0, 0);
    leanSum += upperBreath;

    /*
      HEAD AND NECK — finally on the bones that carry the head's skin. Pitch
      (+x = toward the camera) carries the nod and the breath; yaw carries the
      drift, the head-follow behind the eyes, and half a counter to the torso
      turn so she keeps facing the lens while her body turns.
    */
    const neckPitch = frame.driftPitch * 1.2 + frame.nodPitch * 0.5 - frame.headFollowPitch * 0.4;
    poseBoth('neck', neckPitch, frame.driftYaw * 1.2 + frame.headFollowYaw * 0.4 + turnHead.value * TURN_TOWARD.shares.neck, 0);
    leanSum += frame.driftPitch * 1.2 + frame.nodPitch * 0.5;
    const headPitch =
      frame.driftPitch * 0.8 +
      frame.nodPitch * 0.5 +
      frame.breathPitch -
      frame.headFollowPitch * 0.6;
    poseBoth(
      'head',
      headPitch,
      frame.driftYaw * 0.8 + frame.headFollowYaw * 0.6 - frame.torsoYaw * 0.5 + turnHead.value * TURN_TOWARD.shares.head,
      -shift * 0.3
    );

    /*
      SHOULDERS, ARMS, HANDS. The arm lift is the speech swell plus the beat;
      the hand FOLLOWS it through a spring so it lags, overshoots and settles —
      overlap and follow-through, the two principles a mechanical arm lacks.
    */
    /*
      THE ARMS WHILE SPEAKING. What was here read as a bicep curl on the Duo:
      the whole forearm rose ~50° on every beat, both sides, every second and a
      half — "hands moving up and down like a robot". A person talking with
      their hands at their sides barely moves the elbow: the beat lives in the
      WRIST and the hand, with a little forearm rotation and a few degrees of
      shoulder, and the two sides never do the same thing. So the elbow now
      carries a fraction of the beat, the wrist most of it, the hand follower
      supplies the overlap, and the speech swell is a small lift, not a pose.
    */
    let maxFlexion = 0;
    for (const side of ['L', 'R'] as const) {
      const zSign = side === 'L' ? 1 : -1;
      const leads = beat.side === (side === 'L' ? 1 : -1);
      const beatAmp = rm ? 0 : beat.amp * beatEnv * (leads ? 1 : beat.both ? 0.4 : 0);
      const lift = beatAmp;
      const followed = handFollow[side].step(lift, rawDelta);
      handLift[side] = followed;

      const rise = (side === 'L' ? frame.shoulderL : frame.shoulderR) + frame.breathY * 0.5 - STANCE.shoulderDrop;
      pose(side === 'L' ? bones.shoulderL : bones.shoulderR, rise + lift * 0.06, 0, 0);

      // The firewall's reach cap, applied where the reach is made: however
      // large a beat, the hand never comes at the viewer (doc 22 §7).
      // `sideBias` is +1 on the left and -1 on the right, so every stance angle
      // below lands on a different value per arm.
      const sideBias = side === 'L' ? 1 : -1;
      const forward = clamp(
        STANCE.armForward + sideBias * STANCE.asymmetry.forward + lift * 0.18,
        0,
        DEFAULT_GESTURE_LIMITS.maxShoulderFlexionRad,
      );
      pose(
        side === 'L' ? bones.upperArmL : bones.upperArmR,
        forward,
        // A touch of rotation about the arm: the palm turns as the hand talks.
        zSign * lift * 0.12,
        zSign * (STANCE.armAbduct + sideBias * STANCE.asymmetry.abduct + lift * 0.08)
      );
      maxFlexion = Math.max(maxFlexion, forward);

      pose(
        side === 'L' ? bones.foreArmL : bones.foreArmR,
        STANCE.elbowBend + sideBias * STANCE.asymmetry.elbow + lift * 0.3 + followed * 0.12,
        0,
        0,
      );

      const wrist = rm ? 0 : (side === 'L' ? frame.wristL : frame.wristR) * 0.15;
      // The wrist is where the beat lives; the follower puts it a beat late.
      pose(side === 'L' ? bones.handL : bones.handR, followed * 0.55 + wrist, 0, zSign * followed * 0.25);
    }

    /*
      FINGERS. A relaxed arc with occasional posture-linked adjustments. The
      gesturing hand opens with its own wrist; the other hand stays settled.
      Curl is local +x (measured); z splays.
    */
    /*
      FINGERS MOVE AS A HAND, NOT AS TEN FINGERS.

      Every digit's angle is one relaxation scalar times a FIXED gradient, so
      they flex together and keep their relative shape. That is what a hand
      does: Häger-Ross & Schieber (2000) measured that even an instructed
      single-finger movement carries the neighbouring digits, and the middle and
      ring have almost no independent control at all.

      Both previous versions were wrong in opposite directions. Ten independent
      noise channels read as fidgeting and came out in PR #31; the writer that
      replaced them sampled its input only at a weight shift, so the hand eased
      for about two seconds and then held still for the 8-20 s until the next
      one. Neither frozen nor fidgeting — one slow scalar that never quite stops
      and never runs away.

      `CURL_BY_FINGER` is the gradient and it already encodes the ordering a
      relaxed hand has: index least, little most. The scalar scales the whole
      set rather than adding to each finger separately, which is what makes this
      coupling rather than ten things that happen to agree.
    */
    for (const f of fingers) {
      const openness = 1 - 0.45 * clamp(handLift[f.side], 0, 1);
      const relax = rm ? 0 : clamp(frame[HAND_CHANNELS[f.side]], 0, 1);
      /*
        The spread down the chain is the same shape the rest curl uses: most at
        the knuckle, least at the tip. A finger that flexed uniformly along its
        length would read as a hinge.
      */
      const share = f.phalanx === 0 ? 0.5 : f.phalanx === 1 ? 0.3 : 0.2;
      /*
        RELAX_RANGE is how far the scalar may bend a finger beyond its rest
        curl — about 9 degrees at the knuckle at full relaxation. Small on
        purpose: this is a hand settling, not a fist closing.
      */
      pose(f.bone, f.curl * openness + relax * f.curl * RELAX_RANGE * share, 0, 0);
    }

    firewall.torsoLeanRad = leanSum;
    firewall.shoulderFlexionRad = maxFlexion;
  };

  return {
    step,
    rest,
    firewall,
    get speechEnvelope() {
      return speechEnv;
    },
    setBaseClip,
    get clipBlend() {
      return clipState ? smoothstep(clipFade) : 0;
    },
  };
}
