/**
 * The gesture-vocabulary gate — doc 22 §7 and §10.7.
 *
 * Doc 02 draws the line this file enforces: *"Natalie 'helps you learn it by
 * heart'; she never 'loves you.'"* That is a constraint on the **body**, not
 * only on the words. A tutor who reaches toward a child, leans into the camera,
 * or holds eye contact past a conversational norm is making a claim about the
 * relationship that the product has decided not to make — and she makes it
 * without saying anything a text classifier could catch.
 *
 * ── HOW THE SPEC'S INSTRUCTION MAPS ONTO REALITY ────────────────────────────
 *
 * §7 says: *"Enumerate the permitted gesture set explicitly and gate the EMAGE
 * output against it."* Those are two different mechanisms, because EMAGE does
 * not emit named gestures — it emits a 30 fps stream of SMPL-X joint rotations.
 * You cannot name-check a pose stream. So this file does both halves:
 *
 *   1. **`PERMITTED_GESTURES`** is the enumerated vocabulary, and it governs
 *      what may be *authored*. Every entry says which conversational function
 *      it serves. `FORBIDDEN_GESTURES` names what is out and cites the doc line
 *      each one violates — so the boundary is legible, and putting one back is
 *      a visible diff in review rather than a quiet constant change.
 *
 *   2. **`gateGestureTrack()`** is the structural gate on the EMAGE stream. It
 *      works on the joints that actually *produce* the forbidden reads: torso
 *      pitch makes a lean-in, shoulder flexion makes a reach, sustained
 *      head-toward-camera makes a stare. Capping those caps the behaviour
 *      regardless of what the model thought it was generating.
 *
 * ── FAIL CLOSED, AND WHAT THAT LOOKS LIKE ───────────────────────────────────
 *
 * §7's fail-closed rule is specific about the failure mode: *"never a frozen
 * T-pose, never an error screen, never a mesh that vanishes mid-sentence."* A
 * rejected track therefore does not stop the body — it falls back to
 * `CALM_IDLE`, which is an authored, deliberately unremarkable rest pose. The
 * child sees a tutor who has gone quiet, not a tutor who has broken.
 *
 * That also means **rejection must be cheap and total**: a track with one bad
 * frame is rejected whole, not spliced. Splicing produces a pose discontinuity
 * mid-sentence, which reads as a glitch and draws exactly the attention the
 * rejection was trying to avoid.
 *
 * ── WHAT THIS FILE CANNOT KNOW ──────────────────────────────────────────────
 *
 * The sign and axis conventions of the SMPL-X rig. `DEFAULT_RIG_SEMANTICS`
 * encodes "+x on spine3 pitches the chest forward" and similar, and **that must
 * be verified against the actual rig before the gate is trusted** — a sign flip
 * would turn the reach cap into a reach *requirement*. `assertRigSemantics()`
 * exists to be run once against a known-forward pose, and the caveat is
 * repeated on the export so it cannot be missed.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §7, §10.7; docs/pack/02, 04, 05
 * SOT-KEYWORDS: safety gesture gate vocabulary emage companionship firewall reach lean gaze fail-closed
 */
import type { GestureTrack } from '../speech/track.ts';
export type GestureFunction = 
/** Signals listening. The backchannel nod, the pre-speech anticipation. */
'attention'
/** Carries content — a count on fingers, a shape in the air, a point at the board. */
 | 'illustrative'
/** Manages the turn — a hand-off, a pause-holding beat. */
 | 'regulatory';
export interface PermittedGesture {
    id: string;
    fn: GestureFunction;
    why: string;
}
/**
 * The authored vocabulary. Attention cues are the point — a tutor who does not
 * appear to be listening is worse than no tutor. Attachment cues are not.
 */
export declare const PERMITTED_GESTURES: readonly PermittedGesture[];
export interface ForbiddenGesture {
    id: string;
    /** Which written rule this would break. Cited, not paraphrased. */
    violates: string;
}
/**
 * Named for legibility. The structural limits below are what actually stop
 * these, but a reviewer should be able to read the boundary without deriving
 * it from radians.
 */
export declare const FORBIDDEN_GESTURES: readonly ForbiddenGesture[];
export declare function isPermittedGesture(id: string): boolean;
export interface GestureLimits {
    /** Chest pitch toward the camera, radians. Beyond this it reads as leaning in. */
    maxTorsoLeanRad: number;
    /** Shoulder flexion, radians. Beyond this the hand is coming at the viewer. */
    maxShoulderFlexionRad: number;
    /** Any single joint's rotation magnitude, radians. Catches wild poses whole. */
    maxJointMagnitudeRad: number;
    /** Per-second change in any joint. A startle is a safety problem, not a style one. */
    maxJointSpeedRadPerSecond: number;
    /**
     * How long the head may stay pointed at the camera. Human conversational
     * mutual gaze runs a few seconds before it becomes a stare; 3 s is inside
     * that and outside "held".
     */
    maxGazeHoldMs: number;
    /** How close to camera-facing counts as gaze, radians. */
    gazeConeRad: number;
}
export declare const DEFAULT_GESTURE_LIMITS: GestureLimits;
/**
 * Which joints mean what, and in which direction.
 *
 * **VERIFY THIS AGAINST THE RIG BEFORE TRUSTING THE GATE.** A sign flip turns
 * the reach cap into a reach requirement, and the gate would then pass exactly
 * the tracks it exists to stop. `assertRigSemantics()` is the check.
 */
export interface RigSemantics {
    torsoJoints: readonly string[];
    shoulderJoints: readonly string[];
    headJoints: readonly string[];
    /** Index within a joint's 3 rotation values that pitches forward. */
    pitchAxis: 0 | 1 | 2;
    /** +1 if a positive pitch value leans toward the camera, -1 otherwise. */
    pitchSign: 1 | -1;
}
export declare const DEFAULT_RIG_SEMANTICS: RigSemantics;
export type ViolationKind = 'malformed-track' | 'torso-lean' | 'shoulder-reach' | 'joint-magnitude' | 'joint-speed' | 'sustained-gaze' | 'unknown-joint';
export interface Violation {
    kind: ViolationKind;
    joint?: string;
    frame?: number;
    value?: number;
    limit?: number;
    message: string;
}
export interface GateResult {
    passed: boolean;
    violations: Violation[];
    /** What to play instead when `passed` is false. Never a T-pose. */
    fallback: typeof CALM_IDLE | null;
}
/**
 * The authored fallback. A rest pose with the arms down and a slow breath —
 * unremarkable on purpose. §7's failure mode is explicit: not a T-pose, not an
 * error screen, not a vanishing mesh. A child should read "she has gone quiet",
 * which is a thing people do, rather than "she is broken", which is not.
 */
export declare const CALM_IDLE: Readonly<{
    id: "calm-idle";
    /** Idle channels that stay live. Breath and blink only — no sway, no gesture. */
    channels: readonly string[];
    why: "Fail-closed rest. Doc 22 §7: never a frozen T-pose, never an error screen.";
}>;
/**
 * Gates one EMAGE track.
 *
 * Rejection is **whole-track**. Splicing out a bad window would produce a pose
 * discontinuity mid-sentence, which reads as a glitch and draws exactly the
 * attention the rejection was trying to avoid — so a track with one bad frame
 * is a track that does not play.
 */
export declare function gateGestureTrack(track: GestureTrack, limits?: GestureLimits, rig?: RigSemantics): GateResult;
export interface IdlePolicy {
    /** Does anything on the stage escalate when the child stops interacting? */
    attentionGetsLouderAfterInactivityMs: number | null;
    /** Any idle state whose read is sulking, waiting, or disappointment. */
    hasDisappointmentState: boolean;
    /** Will the tutor appear unprompted outside waking hours? */
    presenceOutsideWakingHours: boolean;
}
/**
 * §7's engagement-pressure rules, as a check rather than a paragraph.
 *
 * These are the mechanics a growth team reaches for by reflex, so the value of
 * asserting them is that adding one becomes a failing test with a doc citation
 * attached rather than a plausible-sounding ticket.
 */
export declare function assertNoEngagementPressure(policy: IdlePolicy): void;
/**
 * Run once, against a track known to lean the chest FORWARD (toward the
 * camera). If this does not report a positive lean, `pitchAxis`/`pitchSign` are
 * wrong and every limit above is inverted — the gate would then pass precisely
 * the tracks it exists to stop, which is the worst failure a safety check has.
 */
export declare function assertRigSemantics(knownForwardLean: GestureTrack, rig?: RigSemantics): void;
