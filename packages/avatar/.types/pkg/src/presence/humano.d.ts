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
import type { Shape } from '../speech/track.ts';
import type { RetargetedClip } from './clip-player.ts';
/**
 * Rigify names as authored, DEFORMING bones only (see the header). `GLTFLoader`
 * runs every node name through `PropertyBinding.sanitizeNodeName`, which strips
 * dots, so each is looked up under both spellings — see `resolveBone`.
 */
export declare const HUMANO_BONES: {
    /** The torso root. Translating it is the weight shift. */
    readonly torso: "DEF-spine";
    readonly spine1: "DEF-spine.001";
    readonly spine2: "DEF-spine.002";
    readonly chest: "DEF-spine.003";
    readonly upperChest: "DEF-spine.004";
    readonly neck: "DEF-spine.005";
    readonly head: "DEF-spine.006";
    /**
     * Position only — the gaze anchor. The eyes themselves are morphs. The
     * DEFORM eye bones, because they ride the head (through its twin chain);
     * the `eye.L` controls sit under `root` and would stay behind a turned head.
     */
    readonly eyeL: "DEF-eye.L";
    readonly eyeR: "DEF-eye.R";
    readonly shoulderL: "DEF-shoulder.L";
    readonly shoulderR: "DEF-shoulder.R";
    readonly upperArmL: "DEF-upper_arm.L";
    readonly upperArmR: "DEF-upper_arm.R";
    readonly foreArmL: "DEF-forearm.L";
    readonly foreArmR: "DEF-forearm.R";
    readonly handL: "DEF-hand.L";
    readonly handR: "DEF-hand.R";
    readonly thighL: "DEF-thigh.L";
    readonly thighR: "DEF-thigh.R";
    readonly shinL: "DEF-shin.L";
    readonly shinR: "DEF-shin.R";
    readonly footL: "DEF-foot.L";
    readonly footR: "DEF-foot.R";
};
/** The finger deform bones, per side, in `FINGER_CHANNELS` order. */
declare const FINGERS: readonly ["thumb", "f_index", "f_middle", "f_ring", "f_pinky"];
declare const PHALANGES: readonly ["01", "02", "03"];
/**
 * The thirty finger bone names, built once and exported so the ownership table
 * and the build check read the same list the writer resolves. A second copy of
 * this loop elsewhere is a list that drifts, which on this rig means a channel
 * that silently moves nothing.
 */
export declare const FINGER_BONES: readonly string[];
/** One finger bone by its parts, so no caller composes the name itself. */
export declare function fingerBone(finger: (typeof FINGERS)[number], phalanx: (typeof PHALANGES)[number], side: 'L' | 'R'): string;
export type HumanoBoneKey = keyof typeof HUMANO_BONES;
/**
 * The control-chain twin of each deforming spine bone — the bone the eyes,
 * teeth and arms actually hang from (see the header). Same world position and
 * orientation as its DEF bone at rest, except the hip root, whose upper-body
 * twin sits 14 cm higher (the legs hang from a different branch and must NOT
 * follow a weight shift); at the lean angles this writer uses the pivot
 * mismatch is under 3 mm.
 */
export declare const TWINS: Partial<Record<HumanoBoneKey, string>>;
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
export declare const STANCE: {
    /** Away from the ribcage, ~7°. */
    readonly armAbduct: 0.12;
    /** Forward of the side seam, ~3°. */
    readonly armForward: 0.05;
    /**
     * Elbows at rest, ~10°, which the asymmetry below splits into roughly 8° and
     * 13°.
     *
     * It was 0.11 (~6°) and read as straight arms hanging at the sides. A relaxed
     * standing arm carries more flexion than that, and at the distance she is
     * rendered 6° is indistinguishable from locked.
     */
    readonly elbowBend: 0.18;
    /** Shoulders drop when nobody is bracing, ~2°. */
    readonly shoulderDrop: 0.035;
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
    readonly asymmetry: {
        /** ~1.7° — one arm hangs a little further from the ribcage. */
        readonly abduct: 0.03;
        /** ~2.6° — and one elbow is more bent than the other. */
        readonly elbow: 0.045;
        /** ~1.1° — one shoulder sits a little further forward. */
        readonly forward: 0.02;
    };
};
/**
 * HANDS CLASPED LOW IN FRONT — the resting posture, in radians, per side.
 *
 * It was arms-folded, twice, and the mesh said no both times. A stacked fold
 * needs each wrist across the midline at chest height, and on this rig — the
 * shirt is baked into the body primitive, so the max-z grid IS the shirt —
 * that put the forearm bones 11-14 mm off the cloth where the arm's own
 * radius is ~30 mm: flesh through fabric, visible on device. Clearing it
 * needs scapular protraction, and this skeleton's writer does not drive the
 * scapula. The pose was anatomically out of reach, not mistuned.
 *
 * The clasp fits. Forearms angle down-forward, hands meet just in front of
 * the lower belly (wrists ~7 cm apart, fingers overlapping between them),
 * and `tools/fold-solve.mjs`'s surface grid verifies 19-25 mm of clearance
 * along arm AND hand — the tight points are fingers, whose radius is
 * ~10 mm, so nothing touches the cloth. It also reads better for this
 * product: folded arms are closed-off body language for a child's tutor;
 * clasped is the attentive-teacher stance.
 */
export declare const FOLD: {
    readonly L: {
        readonly forward: 0.64;
        readonly rot: 1.262;
        readonly abduct: 0.1;
        readonly elbow: 0.226;
        readonly hand: -0.425;
        readonly handYaw: 0.8;
        readonly pron: -1.2;
    };
    readonly R: {
        readonly forward: 0.473;
        readonly rot: 1.248;
        readonly abduct: 0.1;
        readonly elbow: 0.301;
        readonly hand: -0.047;
        readonly handYaw: -0.5;
        readonly pron: 0;
    };
    /**
     * Solved knuckle curl per finger at full clasp, radians; phalanges 02/03
     * follow at the 0.8/0.5 ratios the solver used. These REPLACE the resting
     * arc at fold = 1 (blended, not added — the rest arc alone already
     * overshoots the solved middle finger).
     */
    readonly fingerCurl: Record<"L" | "R", Record<(typeof FINGERS)[number], number>>;
    /** The solver's phalanx follow ratios. */
    readonly phalanxRatio: Record<"01" | "02" | "03", number>;
};
/**
 * The resting elbow angle for one side, stance plus that side's asymmetry.
 *
 * Exported so the writer and the tests read ONE definition. Three assertions
 * used the bare `STANCE.elbowBend` as the arms-at-rest baseline, which was
 * correct only while both elbows held the same angle — the thing that made her
 * read as a mannequin. A helper is how the baseline moves in one place.
 */
export declare function stanceElbow(side: 'L' | 'R'): number;
/** three's own sanitiser, reproduced so a lookup can try both spellings. */
export declare function sanitizeNodeName(name: string): string;
/**
 * Degrees of eye deflection that map to a full ARKit look morph. 5° made every
 * saccade a full-range dart; 15° keeps them subtle and leaves room for the
 * constant look-at-camera bias.
 */
export declare const GAZE_RANGE_DEG = 15;
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
export declare const TURN_TOWARD: {
    readonly maxRad: number;
    readonly shares: {
        readonly spine2: 0.15;
        readonly chest: 0.15;
        readonly neck: 0.35;
        readonly head: 0.35;
    };
};
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
export declare const LIP_ZERO: Readonly<LipShape>;
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
export declare function lipFromOpenness(openness: number): LipShape;
/** The eight ARKit eye-look weights for a gaze direction, in radians. */
export declare function gazeMorphs(yaw: number, pitch: number): Record<string, number>;
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
    /**
     * The utterance's amplitude envelope, 0..1 — the energy of HER OWN synthetic
     * voice (life-layer: every motion has a cause, and this cause is hers;
     * never derived from the child's audio). Continuous where `speaking` is
     * binary: the idle engine scales its torso and shoulder ambient amplitudes
     * with it, always inside their config ceilings, so a loud phrase carries
     * more body than a murmur (torsoEnergyCorrelation finding, 8e62c1b).
     * Omitted, the modulation is disengaged and the body is bit-identical to
     * before this input existed.
     */
    speechEnergy?: number;
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
    readonly firewall: {
        torsoLeanRad: number;
        shoulderFlexionRad: number;
    };
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
/** Entering or leaving a clip base eases over this long. Smoothstep, no snap. */
export declare const CLIP_FADE_S = 0.4;
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
/**
 * The seed is fixed by default and that is deliberate: doc 22 §8's golden
 * capture is only reproducible if the idle engine replays identically, and a
 * child never sees two Natalies side by side to notice they breathe alike.
 */
export declare function createHumanoPresence(scene: THREE.Object3D, options?: {
    seed?: number;
}): HumanoPresence;
export {};
