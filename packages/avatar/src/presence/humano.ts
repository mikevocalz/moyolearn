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
import { IdleEngine, type IdleInputs } from '../idle/engine.ts';

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
} as const;

export type HumanoBoneKey = keyof typeof HUMANO_BONES;

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

  const engine = new IdleEngine(options.seed ?? 12345);
  const lip: LipShape = { ...LIP_ZERO };
  const beat: BeatState = { countdown: 0.35, t: 99, dur: 0.7, side: 1, both: false, amp: 0 };
  let speechEnv = 0;

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
  };

  const step = (deltaSeconds: number, input: HumanoInput): void => {
    // A tab return or a resumed freeze can hand a delta of seconds. Clamped,
    // because the idle engine integrates and a 2s step is a lurch, not a catch-up.
    const rawDelta = Math.max(0, Math.min(deltaSeconds, 0.05));
    const delta = input.reducedMotion ? 0 : rawDelta;
    const frame = engine.step(delta, input.speaking ? IDLE_SPEAKING : IDLE_QUIET);

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

    // Co-speech beats: scheduled while she speaks, bell envelope, one arm
    // leading. Hands rest below a waist-up crop, so a beat needs real lift or
    // it is a gesture nobody can see.
    if (input.speaking && !input.reducedMotion) {
      beat.countdown -= delta;
      if (beat.countdown <= 0 && beat.t >= beat.dur) {
        beat.t = 0;
        beat.dur = 0.75 + Math.random() * 0.5;
        beat.side = Math.random() < 0.5 ? 1 : -1;
        beat.both = Math.random() < 0.35;
        beat.amp = 0.55 + Math.random() * 0.4;
        beat.countdown = beat.dur + 0.4 + Math.random() * 1.0;
      }
    }
    if (beat.t < beat.dur) beat.t += delta;
    const beatEnv = beat.t < beat.dur ? Math.sin(Math.PI * (beat.t / beat.dur)) : 0;

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
    const chestRest = restore(bones.chest);
    if (chestRest && bones.chest) {
      bones.chest.rotation.x = chestRest.rotation.x + frame.breathY * 10;
      bones.chest.position.y = chestRest.position.y + frame.breathY * 0.08;
    }

    for (const side of ['L', 'R'] as const) {
      const shoulder = side === 'L' ? bones.shoulderL : bones.shoulderR;
      const shoulderRest = restore(shoulder);
      if (shoulderRest && shoulder) {
        shoulder.rotation.z = shoulderRest.rotation.z + frame.breathY * 0.5 * (side === 'L' ? 1 : -1);
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
        upperArm.rotation.x = upperRest.rotation.x + lift * 0.45;
        upperArm.rotation.z = upperRest.rotation.z + zSign * lift * 0.15;
      }
      const foreArm = side === 'L' ? bones.foreArmL : bones.foreArmR;
      const foreRest = restore(foreArm);
      if (foreRest && foreArm) foreArm.rotation.x = foreRest.rotation.x + lift * 1.3;

      const hand = side === 'L' ? bones.handL : bones.handR;
      const handRest = restore(hand);
      if (handRest && hand) hand.rotation.x = handRest.rotation.x + lift * 0.45;
    }
  };

  return { step, rest };
}
