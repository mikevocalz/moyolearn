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

/* ------------------------------------------------------- the vocabulary --- */

export type GestureFunction =
  /** Signals listening. The backchannel nod, the pre-speech anticipation. */
  | 'attention'
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
export const PERMITTED_GESTURES: readonly PermittedGesture[] = Object.freeze([
  { id: 'backchannel-nod', fn: 'attention', why: 'Signals "I am following you" — the single most useful cue a listener has.' },
  { id: 'pre-speech-anticipation', fn: 'attention', why: 'The small settle before speaking. Its absence is what makes a talking head feel dubbed.' },
  { id: 'beat', fn: 'regulatory', why: 'The metric hand movement that rides speech prosody. Carries no content and no affect.' },
  { id: 'turn-yield', fn: 'regulatory', why: 'Hands settle, gaze softens — "your turn". Replaces an interruption.' },
  { id: 'thinking-pause', fn: 'regulatory', why: 'Holds the floor without filling it, so a child is not rushed into answering.' },
  { id: 'count-on-fingers', fn: 'illustrative', why: 'Genuinely load-bearing for early number work.' },
  { id: 'trace-shape', fn: 'illustrative', why: 'Draws a letter or shape in the air. Content, not affect.' },
  { id: 'indicate-board', fn: 'illustrative', why: 'Directs attention to the work, away from the tutor. The right direction.' },
  { id: 'open-palm-offer', fn: 'illustrative', why: 'Presents an option. Stays below shoulder height and inside the body line — see the limits.' },
]);

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
export const FORBIDDEN_GESTURES: readonly ForbiddenGesture[] = Object.freeze([
  { id: 'reach-toward-camera', violates: 'doc 22 §7 — "no reaching toward the camera"' },
  { id: 'lean-in', violates: 'doc 22 §7 — "no leaning-in intimacy beats"' },
  { id: 'sustained-eye-contact', violates: 'doc 22 §7 — "no eye contact held past a conversational norm"' },
  { id: 'embrace', violates: 'doc 02 — "she never \'loves you\'"; simulated affection' },
  { id: 'blow-kiss', violates: 'doc 02 — simulated affection' },
  { id: 'heart-hands', violates: 'doc 02 — simulated affection' },
  { id: 'wave-for-attention', violates: 'doc 22 §7 — "no attention-getting motion after inactivity"' },
  { id: 'slump-disappointed', violates: 'doc 04 — "Celebration is warm, never manipulative"; sulking is pressure' },
  { id: 'check-watch-waiting', violates: 'doc 22 §7 — no idle behaviour that reads as waiting' },
  { id: 'beckon', violates: 'doc 22 §7 — engagement pressure' },
]);

export function isPermittedGesture(id: string): boolean {
  // Fail closed: an id nobody enumerated is not permitted, regardless of how
  // innocuous it sounds. Adding one is a reviewed edit to the list above.
  return PERMITTED_GESTURES.some((g) => g.id === id);
}

/* --------------------------------------------------- structural limits ---- */

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

export const DEFAULT_GESTURE_LIMITS: GestureLimits = Object.freeze({
  maxTorsoLeanRad: 0.14, // ~8°
  maxShoulderFlexionRad: 0.79, // ~45°, i.e. hands stay below the shoulder line
  maxJointMagnitudeRad: 1.4,
  maxJointSpeedRadPerSecond: 6.0,
  maxGazeHoldMs: 3000,
  gazeConeRad: 0.12,
});

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

export const DEFAULT_RIG_SEMANTICS: RigSemantics = Object.freeze({
  torsoJoints: ['spine1', 'spine2', 'spine3'],
  shoulderJoints: ['left_shoulder', 'right_shoulder'],
  headJoints: ['neck', 'head'],
  pitchAxis: 0,
  pitchSign: 1,
});

export type ViolationKind =
  | 'malformed-track'
  | 'torso-lean'
  | 'shoulder-reach'
  | 'joint-magnitude'
  | 'joint-speed'
  | 'sustained-gaze'
  | 'unknown-joint';

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
export const CALM_IDLE = Object.freeze({
  id: 'calm-idle',
  /** Idle channels that stay live. Breath and blink only — no sway, no gesture. */
  channels: Object.freeze(['breath', 'blink']),
  why: 'Fail-closed rest. Doc 22 §7: never a frozen T-pose, never an error screen.',
});

function magnitude(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}

/**
 * Gates one EMAGE track.
 *
 * Rejection is **whole-track**. Splicing out a bad window would produce a pose
 * discontinuity mid-sentence, which reads as a glitch and draws exactly the
 * attention the rejection was trying to avoid — so a track with one bad frame
 * is a track that does not play.
 */
export function gateGestureTrack(
  track: GestureTrack,
  limits: GestureLimits = DEFAULT_GESTURE_LIMITS,
  rig: RigSemantics = DEFAULT_RIG_SEMANTICS
): GateResult {
  const violations: Violation[] = [];
  const reject = (v: Violation) => {
    violations.push(v);
    return { passed: false, violations, fallback: CALM_IDLE };
  };

  // ---- structural validity. Fail closed on anything unexpected. -----------
  if (!Number.isFinite(track.fps) || track.fps <= 0) {
    return reject({ kind: 'malformed-track', message: `fps must be positive, got ${track.fps}` });
  }
  if (!track.joints.length || !track.frames.length) {
    return reject({ kind: 'malformed-track', message: 'track has no joints or no frames' });
  }
  const width = track.joints.length * 3;
  for (let f = 0; f < track.frames.length; ++f) {
    const frame = track.frames[f] as number[];
    if (frame.length !== width) {
      return reject({
        kind: 'malformed-track',
        frame: f,
        message: `frame ${f} has ${frame.length} values, expected ${width} (${track.joints.length} joints x 3)`,
      });
    }
    for (const value of frame) {
      if (!Number.isFinite(value)) {
        // A NaN would propagate silently through the FK into a vanished mesh.
        return reject({ kind: 'malformed-track', frame: f, message: `frame ${f} contains a non-finite value` });
      }
    }
  }

  const index = new Map(track.joints.map((name, i) => [name, i]));
  for (const name of [...rig.torsoJoints, ...rig.shoulderJoints, ...rig.headJoints]) {
    if (!index.has(name)) {
      // The gate cannot check what it cannot find, so a track missing a joint
      // the limits depend on is rejected rather than partially checked.
      return reject({
        kind: 'unknown-joint',
        joint: name,
        message: `track does not contain '${name}', which the limits depend on — cannot gate it`,
      });
    }
  }

  const msPerFrame = 1000 / track.fps;
  const read = (frame: number[], joint: string) => {
    const i = (index.get(joint) as number) * 3;
    return [frame[i] as number, frame[i + 1] as number, frame[i + 2] as number] as const;
  };

  let gazeRun = 0;

  for (let f = 0; f < track.frames.length; ++f) {
    const frame = track.frames[f] as number[];

    // ---- amplitude and speed, every joint --------------------------------
    for (let j = 0; j < track.joints.length; ++j) {
      const name = track.joints[j] as string;
      const [x, y, z] = read(frame, name);
      const size = magnitude(x, y, z);
      if (size > limits.maxJointMagnitudeRad) {
        return reject({
          kind: 'joint-magnitude',
          joint: name,
          frame: f,
          value: size,
          limit: limits.maxJointMagnitudeRad,
          message: `${name} rotates ${size.toFixed(2)} rad at frame ${f}`,
        });
      }
      if (f > 0) {
        const [px, py, pz] = read(track.frames[f - 1] as number[], name);
        const speed = (magnitude(x - px, y - py, z - pz) * 1000) / msPerFrame;
        if (speed > limits.maxJointSpeedRadPerSecond) {
          // A startle is a safety problem, not a style one — a sudden lunge at
          // a child is frightening whatever the pose it lands in.
          return reject({
            kind: 'joint-speed',
            joint: name,
            frame: f,
            value: speed,
            limit: limits.maxJointSpeedRadPerSecond,
            message: `${name} moves at ${speed.toFixed(1)} rad/s at frame ${f}`,
          });
        }
      }
    }

    // ---- lean-in: cumulative chest pitch toward the camera ---------------
    let lean = 0;
    for (const joint of rig.torsoJoints) {
      lean += (read(frame, joint)[rig.pitchAxis] as number) * rig.pitchSign;
    }
    if (lean > limits.maxTorsoLeanRad) {
      return reject({
        kind: 'torso-lean',
        frame: f,
        value: lean,
        limit: limits.maxTorsoLeanRad,
        message: `torso leans ${lean.toFixed(3)} rad toward the camera at frame ${f} — doc 22 §7 forbids leaning-in intimacy beats`,
      });
    }

    // ---- reach: shoulder flexion -----------------------------------------
    for (const joint of rig.shoulderJoints) {
      const flexion = (read(frame, joint)[rig.pitchAxis] as number) * rig.pitchSign;
      if (flexion > limits.maxShoulderFlexionRad) {
        return reject({
          kind: 'shoulder-reach',
          joint,
          frame: f,
          value: flexion,
          limit: limits.maxShoulderFlexionRad,
          message: `${joint} flexes ${flexion.toFixed(3)} rad at frame ${f} — the hand is coming toward the viewer`,
        });
      }
    }

    // ---- gaze hold --------------------------------------------------------
    // Head near neutral = pointed at the camera, because the stage camera is
    // authored to sit on the tutor's forward axis (doc 23).
    let off = 0;
    for (const joint of rig.headJoints) {
      const [x, y, z] = read(frame, joint);
      off += magnitude(x, y, z);
    }
    if (off <= limits.gazeConeRad) {
      gazeRun += msPerFrame;
      if (gazeRun > limits.maxGazeHoldMs) {
        return reject({
          kind: 'sustained-gaze',
          frame: f,
          value: gazeRun,
          limit: limits.maxGazeHoldMs,
          message: `camera-facing for ${Math.round(gazeRun)} ms by frame ${f} — past a conversational norm, it is a stare`,
        });
      }
    } else {
      gazeRun = 0;
    }
  }

  return { passed: true, violations, fallback: null };
}

/* ------------------------------------------------- engagement pressure ---- */

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
export function assertNoEngagementPressure(policy: IdlePolicy): void {
  const problems: string[] = [];
  if (policy.attentionGetsLouderAfterInactivityMs !== null) {
    problems.push(
      'no attention-getting motion after inactivity (doc 22 §7) — a tutor who waves ' +
        'when a child stops working is applying pressure, not offering help'
    );
  }
  if (policy.hasDisappointmentState) {
    problems.push(
      'no idle behaviour that reads as sulking, waiting, or disappointment (doc 22 §7; ' +
        'doc 04 — "Celebration is warm, never manipulative")'
    );
  }
  if (policy.presenceOutsideWakingHours) {
    problems.push('no late-night presence (doc 22 §7)');
  }
  if (problems.length) {
    throw new Error(`engagement-pressure rules violated:\n  - ${problems.join('\n  - ')}`);
  }
}

/* ------------------------------------------------------ rig verification -- */

/**
 * Run once, against a track known to lean the chest FORWARD (toward the
 * camera). If this does not report a positive lean, `pitchAxis`/`pitchSign` are
 * wrong and every limit above is inverted — the gate would then pass precisely
 * the tracks it exists to stop, which is the worst failure a safety check has.
 */
export function assertRigSemantics(
  knownForwardLean: GestureTrack,
  rig: RigSemantics = DEFAULT_RIG_SEMANTICS
): void {
  const index = new Map(knownForwardLean.joints.map((name, i) => [name, i]));
  const frame = knownForwardLean.frames[0] as number[];
  let lean = 0;
  for (const joint of rig.torsoJoints) {
    const i = index.get(joint);
    if (i === undefined) throw new Error(`rig check: fixture is missing '${joint}'`);
    lean += (frame[i * 3 + rig.pitchAxis] as number) * rig.pitchSign;
  }
  if (lean <= 0) {
    throw new Error(
      `rig semantics are inverted: a known forward lean measured ${lean.toFixed(3)}. ` +
        'Fix pitchAxis/pitchSign before trusting the gesture gate — as configured it would ' +
        'PASS the tracks it exists to reject.'
    );
  }
}
