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
 * SOT: packages/avatar/src/idle/engine.ts · apps/web-vite/src/components/chapters/natalie-scene.tsx
 *      docs/pack/22-embodied-tutor-avatar-spec.md §7 · docs/decisions/adr-111-native-3d-runtime.md
 * SOT-KEYWORDS: humano presence natalie idle morph bones gaze breath beat native web shared
 */
import * as THREE from 'three';
import { IdleEngine, mulberry32, type IdleInputs } from '../idle/engine.ts';

/**
 * Rigify names as authored. `GLTFLoader` runs every node name through
 * `PropertyBinding.sanitizeNodeName`, which strips dots, so each is looked up
 * under both spellings — see `resolveBone`.
 */
export const HUMANO_BONES = {
  chest: 'chest',
  neck: 'neck',
  head: 'head',
  jaw: 'jaw_master',
  eyeL: 'eye.L',
  eyeR: 'eye.R',
  shoulderL: 'DEF-shoulder.L',
  shoulderR: 'DEF-shoulder.R',
  upperArmL: 'DEF-upper_arm.L',
  upperArmR: 'DEF-upper_arm.R',
  foreArmL: 'DEF-forearm.L',
  foreArmR: 'DEF-forearm.R',
  handL: 'DEF-hand.L',
  handR: 'DEF-hand.R',
  // The stack that makes a standing body read as weight on legs rather than a
  // plank on a stick. `swayX`/`swayY` were computed by the idle engine every
  // frame and thrown away because nothing here claimed a bone for them.
  hips: 'DEF-pelvis',
  spine: 'DEF-spine',
  spine1: 'DEF-spine.001',
} as const;

/**
 * The finger deform bones, per side. 100+ joints are rigged and NONE were
 * driven, which is most of why she read as a mannequin: a straight, splayed
 * hand is a shop-window hand. Three phalanges each, thumb included.
 */
const FINGERS = ['f_index', 'f_middle', 'f_ring', 'f_pinky', 'thumb'] as const;
const PHALANGES = ['01', '02', '03'] as const;

/**
 * Resting curl per phalanx, in radians. A hand at rest is not flat: the
 * fingers hold a soft arc that tightens toward the tip, and the little finger
 * curls more than the index. The thumb rotates rather than curls, so it gets
 * its own, smaller number.
 */
const CURL = { '01': 0.16, '02': 0.28, '03': 0.24 } as const;
const CURL_BY_FINGER: Record<(typeof FINGERS)[number], number> = {
  f_index: 0.8,
  f_middle: 0.95,
  f_ring: 1.1,
  f_pinky: 1.25,
  thumb: 0.45,
};

export type HumanoBoneKey = keyof typeof HUMANO_BONES;

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
  /** Elbows are never locked, ~6°. */
  elbowBend: 0.11,
  /** Shoulders drop when nobody is bracing, ~2°. */
  shoulderDrop: 0.035,
} as const;


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
export function gazeMorphs(
  yaw: number,
  pitch: number
): Record<string, number> {
  const clamp = (v: number) => Math.max(-1, Math.min(1, v / (GAZE_RANGE_DEG * DEG)));
  const y = clamp(yaw);
  const p = clamp(pitch);
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
  /** Doc 22 §7: a render mode, not a preference. No travel, no beats. */
  reducedMotion: boolean;
  /** Where the learner's eye is, so her gaze lands on it and not past it. */
  cameraPosition?: THREE.Vector3 | null;
}

export interface HumanoPresence {
  step(deltaSeconds: number, input: HumanoInput): void;
  /** Rest pose restored and morphs zeroed — the state a freeze should hold. */
  rest(): void;
}

interface BoneRest {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
}

interface BeatState {
  countdown: number;
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

const IDLE_SPEAKING: IdleInputs = { ...IDLE_QUIET, speechActive: true, timeUntilOnset: 0 };

/**
 * The conversation, as the idle engine already knew how to hear it.
 *
 * `IdleInputs` has carried `partnerSpeaking`, `processing`, `speechGap` and
 * `timeUntilOnset` since the port, and every one of them was pinned to a
 * constant — so the backchannel nods, the thinking gaze and the pre-speech
 * anticipation the engine implements have never once fired. She had two modes,
 * talking and not.
 *
 * Now the caller says which phase she is in and the engine gets its inputs:
 *
 *   speaking  — sound is coming out. Beats, mouth, the speech swell.
 *   thinking  — the model is composing. `processing` drives the gaze away and
 *               the small stilling that reads as "working on it".
 *   listening — the learner is typing or talking. `partnerSpeaking` is what
 *               the backchannel nods hang off; without it she stares.
 *   waiting   — a turn is finished and neither of them has moved.
 */
export type ConversationPhase = 'speaking' | 'thinking' | 'listening' | 'waiting';

function idleInputsFor(phase: ConversationPhase): IdleInputs {
  switch (phase) {
    case 'speaking':
      return IDLE_SPEAKING;
    case 'thinking':
      // A turn is being composed, so speech IS coming — the engine's
      // anticipation window is what makes the first word land on a face that
      // was already on its way there rather than one that snaps into it.
      return { ...IDLE_QUIET, processing: true, timeUntilOnset: 1.2 };
    case 'listening':
      return { ...IDLE_QUIET, partnerSpeaking: true };
    case 'waiting':
      return { ...IDLE_QUIET, speechGap: true };
  }
}

function setMorph(mesh: THREE.SkinnedMesh, name: string, value: number): void {
  const dict = mesh.morphTargetDictionary;
  const influences = mesh.morphTargetInfluences;
  if (!dict || !influences) return;
  const index = dict[name];
  if (index === undefined) return;
  influences[index] = value;
}

function resolveBone(scene: THREE.Object3D, name: string): THREE.Bone | null {
  const direct = scene.getObjectByName(name);
  if (direct) return direct as THREE.Bone;
  const sanitized = scene.getObjectByName(sanitizeNodeName(name));
  return sanitized ? (sanitized as THREE.Bone) : null;
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
  for (const key of Object.keys(HUMANO_BONES) as HumanoBoneKey[]) {
    const bone = resolveBone(scene, HUMANO_BONES[key]);
    bones[key] = bone;
    if (bone && !rests.has(bone)) {
      rests.set(bone, {
        position: bone.position.clone(),
        quaternion: bone.quaternion.clone(),
        rotation: bone.rotation.clone(),
        scale: bone.scale.clone(),
      });
    }
  }

  /*
    The finger chains, resolved once. Same rest capture as the named bones so
    `restore()` and `rest()` cover them without a second code path.
  */
  const fingers: { bone: THREE.Bone; curl: number }[] = [];
  for (const side of ['L', 'R'] as const) {
    for (const finger of FINGERS) {
      for (const phalanx of PHALANGES) {
        const bone = resolveBone(scene, `DEF-${finger}.${phalanx}.${side}`);
        if (!bone) continue;
        if (!rests.has(bone)) {
          rests.set(bone, {
            position: bone.position.clone(),
            quaternion: bone.quaternion.clone(),
            rotation: bone.rotation.clone(),
            scale: bone.scale.clone(),
          });
        }
        fingers.push({ bone, curl: CURL[phalanx] * CURL_BY_FINGER[finger] });
      }
    }
  }

  const engine = new IdleEngine(options.seed ?? 12345);
  /*
    Beats draw from the SEEDED stream, not `Math.random`. The idle layer's whole
    contract is "same seed, bit-identical outputs" — that is what makes the
    golden capture (doc 22 §8) reproducible — and the beat scheduler was quietly
    breaking it with three `Math.random()` calls per gesture.
  */
  const rng = mulberry32((options.seed ?? 12345) ^ 0x5eed);
  const lip: LipShape = { ...LIP_ZERO };
  const beat: BeatState = { countdown: 0.35, t: 99, dur: 0.7, side: 1, both: false, amp: 0 };
  let speechEnv = 0;
  /** Seconds since mount, for the slow non-repeating hand drift. */
  let clock = 0;

  const eyeMid = new THREE.Vector3();
  const eyeOther = new THREE.Vector3();
  const toCamera = new THREE.Vector3();

  /** Restores one bone to rest and returns the rest it was restored to. */
  const restore = (bone: THREE.Bone | null): BoneRest | null => {
    if (!bone) return null;
    const rest = rests.get(bone);
    if (!rest) return null;
    bone.position.copy(rest.position);
    bone.rotation.copy(rest.rotation);
    bone.scale.copy(rest.scale);
    return rest;
  };

  const rest = (): void => {
    for (const bone of rests.keys()) restore(bone);
    for (const mesh of meshes) mesh.morphTargetInfluences?.fill(0);
    for (const key of Object.keys(lip) as (keyof LipShape)[]) lip[key] = 0;
    speechEnv = 0;
    beat.t = 99;
  };

  const step = (deltaSeconds: number, input: HumanoInput): void => {
    // A tab return or a resumed freeze can hand a delta of seconds. Clamped,
    // because the idle engine integrates and a 2s step is a lurch, not a catch-up.
    const rawDelta = Math.max(0, Math.min(deltaSeconds, 0.05));
    const delta = input.reducedMotion ? 0 : rawDelta;
    clock += delta;
    const phase: ConversationPhase =
      input.phase ?? (input.speaking ? 'speaking' : 'waiting');
    const frame = engine.step(delta, idleInputsFor(phase));

    // Speech envelope: the whole-utterance swell the arms and brow ride on.
    // It follows the speaking flag rather than a clip duration because the
    // device path streams and has no duration until the utterance is over.
    const envTarget = input.speaking && !input.reducedMotion ? 1 : 0;
    speechEnv += (envTarget - speechEnv) * (1 - Math.exp(-rawDelta * 6));

    // Asymmetric mouth smoothing, like real articulation: snap toward a shape
    // (~22ms), relax out of it (~60ms). A symmetric low-pass lands every shape
    // late and mushy.
    const target = input.reducedMotion ? LIP_ZERO : lipFromOpenness(input.mouth);
    const rise = 1 - Math.exp(-rawDelta * 45);
    const fall = 1 - Math.exp(-rawDelta * 16);
    for (const key of Object.keys(LIP_ZERO) as (keyof LipShape)[]) {
      const to = target[key];
      lip[key] += (to - lip[key]) * (to > lip[key] ? rise : fall);
    }

    /*
      CO-SPEECH BEATS, WITH A RETRACTION — and the retraction is the bug fix.

      A beat used to run its full bell after `speaking` went false: scheduling
      stopped, but an in-flight gesture kept its envelope for up to 1.25s, so
      her arms went on waving into the silence. Gesture studies call the three
      phases preparation / stroke / retraction, and the third one was missing:
      she prepared and struck and then just stayed there until the timer said
      otherwise.

      Now the envelope is multiplied by `speechEnv`, which decays with the
      voice, and the phases are asymmetric — a fast stroke into the accented
      syllable and a slower settle out of it, which is how an arm actually
      moves. A symmetric sine reads mechanical because nothing in a body
      accelerates and decelerates at the same rate.
    */
    if (input.speaking && !input.reducedMotion) {
      beat.countdown -= delta;
      if (beat.countdown <= 0 && beat.t >= beat.dur) {
        beat.t = 0;
        beat.dur = 0.75 + rng() * 0.5;
        beat.side = rng() < 0.5 ? 1 : -1;
        beat.both = rng() < 0.35;
        beat.amp = 0.55 + rng() * 0.4;
        beat.countdown = beat.dur + 0.4 + rng() * 1.0;
      }
    }
    if (beat.t < beat.dur) beat.t += delta;
    const beatPhase = beat.t < beat.dur ? beat.t / beat.dur : 1;
    // Stroke in the first 35%, settle over the remaining 65%.
    const rawBeat =
      beatPhase >= 1
        ? 0
        : beatPhase < 0.35
          ? smoothstep(beatPhase / 0.35)
          : 1 - smoothstep((beatPhase - 0.35) / 0.65);
    // The gate. No voice, no gesture — however far through its bell it was.
    const beatEnv = rawBeat * speechEnv;

    // --- gaze: bias at the camera, saccades on top. Without the bias the eyes
    // saccade around the model's forward axis, which points past the lens.
    let gazeYaw = frame.eyeYaw;
    let gazePitch = frame.eyePitch;
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
      setMorph(mesh, 'eyeBlinkLeft', frame.eyeBlinkLeft);
      setMorph(mesh, 'eyeBlinkRight', frame.eyeBlinkRight);
      setMorph(mesh, 'eyeWideLeft', frame.eyesWide);
      setMorph(mesh, 'eyeWideRight', frame.eyesWide);
      for (const [name, value] of Object.entries(gaze)) setMorph(mesh, name, value);
      for (const [name, value] of Object.entries(lip)) setMorph(mesh, name, value);
      // Gesture and prosody move together — a beat carries a brow accent.
      setMorph(mesh, 'browInnerUp', 0.2 * beatEnv);
    }

    // --- body. Root and pelvis stay at rest: she is anchored, never rocking.
    /*
      WEIGHT, which is the difference between standing and being stood up.

      The idle engine has produced `swayX`/`swayY` since it was ported and
      nothing has ever read them — she was rigid from the pelvis down while a
      perfectly good postural signal was computed and dropped every frame.
      A person at rest shifts their weight between their legs on a slow,
      irregular cycle; the pelvis translates and tilts, and the spine
      counter-rotates above it so the head stays level. That counter-rotation
      is the part that reads as a body rather than a bobbing statue.
    */
    const hipsRest = restore(bones.hips);
    if (hipsRest && bones.hips) {
      bones.hips.position.x = hipsRest.position.x + frame.swayX;
      bones.hips.position.y = hipsRest.position.y + frame.swayY;
      // Tilt into the loaded leg. Small — the eye reads the direction, not the
      // angle, and an obvious tilt looks like a limp.
      bones.hips.rotation.z = hipsRest.rotation.z + frame.swayX * 1.6;
    }
    for (const [bone, share] of [
      [bones.spine, 0.55],
      [bones.spine1, 0.35],
    ] as const) {
      const spineRest = restore(bone);
      if (spineRest && bone) {
        bone.rotation.z = spineRest.rotation.z - frame.swayX * 1.6 * share;
        bone.rotation.x = spineRest.rotation.x + frame.breathY * 4 * share;
      }
    }

    /*
      HANDS. A relaxed arc, tightening toward the tip and toward the little
      finger, plus a slow per-bone drift so the two hands are never the same
      hand. They open a little into a gesture — a beat with a clenched hand
      reads as a threat, not a point.
    */
    const openness = 1 - 0.45 * beatEnv;
    for (let i = 0; i < fingers.length; i++) {
      const { bone, curl } = fingers[i] as { bone: THREE.Bone; curl: number };
      const fingerRest = restore(bone);
      if (!fingerRest) continue;
      // Phase-offset per bone: a hand whose fingers move in lockstep is a glove.
      const drift = input.reducedMotion ? 0 : Math.sin(clock * 0.7 + i * 1.7) * 0.012;
      bone.rotation.z = fingerRest.rotation.z + curl * openness + drift;
    }

    const chestRest = restore(bones.chest);
    if (chestRest && bones.chest) {
      bones.chest.rotation.x = chestRest.rotation.x + frame.breathY * 10;
      bones.chest.position.y = chestRest.position.y + frame.breathY * 0.08;
    }

    for (const side of ['L', 'R'] as const) {
      const zSign = side === 'L' ? 1 : -1;
      const shoulder = side === 'L' ? bones.shoulderL : bones.shoulderR;
      const shoulderRest = restore(shoulder);
      if (shoulderRest && shoulder) {
        shoulder.rotation.z =
          shoulderRest.rotation.z + (frame.breathY * 0.5 - STANCE.shoulderDrop) * zSign;
      }
    }

    const neckRest = restore(bones.neck);
    if (neckRest && bones.neck) {
      bones.neck.rotation.y = neckRest.rotation.y + frame.driftYaw * 1.2;
      bones.neck.rotation.x = neckRest.rotation.x + frame.driftPitch * 1.2 + frame.nodPitch * 0.5;
    }

    const headRest = restore(bones.head);
    if (headRest && bones.head) {
      bones.head.rotation.y = headRest.rotation.y + frame.driftYaw * 0.8;
      bones.head.rotation.x =
        headRest.rotation.x + frame.driftPitch * 0.8 + frame.nodPitch * 0.5 + lip.jawOpen * 0.05;
    }

    // A real chin drop under the jawOpen morph — the morph alone moves lips,
    // not the jaw, and the mismatch is the "talking mask" read.
    const jawRest = restore(bones.jaw);
    if (jawRest && bones.jaw) {
      bones.jaw.rotation.x = jawRest.rotation.x + lip.jawOpen * 0.14;
    }

    const speechLift = 0.18 * speechEnv;
    for (const side of ['L', 'R'] as const) {
      const leads = beat.side === (side === 'L' ? 1 : -1);
      const beatAmp = input.reducedMotion
        ? 0
        : beat.amp * beatEnv * (leads ? 1 : beat.both ? 0.55 : 0);
      const lift = speechLift + beatAmp;
      const zSign = side === 'L' ? 1 : -1;

      const upperArm = side === 'L' ? bones.upperArmL : bones.upperArmR;
      const upperRest = restore(upperArm);
      if (upperRest && upperArm) {
        upperArm.rotation.x = upperRest.rotation.x + STANCE.armForward + lift * 0.45;
        upperArm.rotation.z = upperRest.rotation.z + zSign * (STANCE.armAbduct + lift * 0.15);
      }
      const foreArm = side === 'L' ? bones.foreArmL : bones.foreArmR;
      const foreRest = restore(foreArm);
      if (foreRest && foreArm) {
        foreArm.rotation.x = foreRest.rotation.x + STANCE.elbowBend + lift * 1.3;
      }

      const hand = side === 'L' ? bones.handL : bones.handR;
      const handRest = restore(hand);
      if (handRest && hand) hand.rotation.x = handRest.rotation.x + lift * 0.45;
    }
  };

  return { step, rest };
}
