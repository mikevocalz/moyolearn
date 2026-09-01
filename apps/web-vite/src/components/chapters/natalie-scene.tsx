'use client';
/**
 * The real-time 3D Natalie scene for Chapter 05. Loads the waist-up Humano GLB
 * and drives a marketing-specific presence profile: anchored body, subtle chest
 * breathing, natural blink/saccade, tiny event-driven head/face gestures.
 *
 * The visitor triggers short responses (hint / explain / encourage). There is
 * no auto-cycling, no continuous rocking, and no hard-coded audio requirement.
 * Real baked voice can later be wired through the shared Moyo `packages/voice`
 * pipeline; until then the experience is silent and captioned.
 *
 * SOT: packages/avatar/src/idle/engine.ts · packages/avatar/src/idle/config.ts
 *      packages/voice/src/baked.ts · apps/web/lib/voice-baked.ts
 *      apps/web-vite/src/components/chapters/tutor-room.tsx
 * SOT-KEYWORDS: natalie scene web-vite r3f three draco humano arkit idle engine
 *               waist-up camera marketing tutor-room presence profile
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { IdleEngine } from '@acme/avatar';

const MODEL_URL = '/models/humano-marketing.glb';
const DRACO_DECODER = '/draco/';

const CAMERA_FOV = 38;
const CAMERA_POS: [number, number, number] = [0, 1.45, 1.15];
const LOOK_AT: [number, number, number] = [0, 1.5, 0];

const DEG = Math.PI / 180;

interface PresenceAction {
  id: string;
  label: string;
  caption: string;
  duration: number;
  voicePiece: string;
  inputs: {
    speechActive: boolean;
    speechGap: boolean;
    processing: boolean;
    partnerSpeaking: boolean;
    partnerPauseEvent: boolean;
    partnerF0Falling: boolean;
    timeUntilOnset: number;
  };
  morphs: Record<string, number>;
  head?: { x?: number; y?: number; z?: number };
  neck?: { x?: number; y?: number; z?: number };
}

export const PRESENCE_ACTIONS: Record<string, PresenceAction> = {
  hint: {
    id: 'hint',
    label: 'Give me a hint',
    caption: 'Try looking for the part that matches what the question is asking.',
    duration: 3.5,
    voicePiece: 'marketing-hint',
    inputs: {
      speechActive: true,
      speechGap: false,
      processing: true,
      partnerSpeaking: false,
      partnerPauseEvent: false,
      partnerF0Falling: false,
      timeUntilOnset: 0,
    },
    morphs: {
      browInnerUp: 0.3,
      eyeLookDownLeft: 0.2,
      eyeLookDownRight: 0.2,
      jawOpen: 0.08,
      mouthSmileLeft: 0.15,
      mouthSmileRight: 0.15,
    },
    head: { y: -0.02 },
    neck: { y: -0.01 },
  },
  explain: {
    id: 'explain',
    label: 'Explain it another way',
    caption: 'Another way to think about it: start with what you already know.',
    duration: 4.5,
    voicePiece: 'marketing-explain',
    inputs: {
      speechActive: true,
      speechGap: false,
      processing: false,
      partnerSpeaking: false,
      partnerPauseEvent: false,
      partnerF0Falling: false,
      timeUntilOnset: 0,
    },
    morphs: {
      browDownLeft: 0.1,
      browDownRight: 0.1,
      jawOpen: 0.1,
      mouthSmileLeft: 0.1,
      mouthSmileRight: 0.1,
    },
    head: { y: 0.02 },
    neck: { y: 0.01 },
  },
  encourage: {
    id: 'encourage',
    label: 'I think I got it',
    caption: 'Nice work — that kind of thinking is what makes it stick.',
    duration: 3.5,
    voicePiece: 'marketing-got-it',
    inputs: {
      speechActive: true,
      speechGap: true,
      processing: false,
      partnerSpeaking: false,
      partnerPauseEvent: false,
      partnerF0Falling: false,
      timeUntilOnset: 0,
    },
    morphs: {
      cheekSquintLeft: 0.3,
      cheekSquintRight: 0.3,
      mouthSmileLeft: 0.45,
      mouthSmileRight: 0.45,
      jawOpen: 0.05,
      browOuterUpLeft: 0.1,
      browOuterUpRight: 0.1,
    },
    head: { y: 0.03, x: 0.01 },
    neck: { y: 0.015, x: 0.005 },
  },
};

const IDLE_INPUTS = {
  speechActive: false,
  speechGap: false,
  processing: false,
  partnerSpeaking: false,
  partnerPauseEvent: false,
  partnerF0Falling: false,
  timeUntilOnset: Infinity,
};

const BONE_NAMES = {
  root: 'root',
  pelvis: 'DEF-pelvis',
  spine: 'DEF-spine',
  chest: 'chest',
  neck: 'neck',
  head: 'head',
  shoulderL: 'DEF-shoulder.L',
  shoulderR: 'DEF-shoulder.R',
  eyeL: 'eye.L',
  eyeR: 'eye.R',
} as const;

function setMorph(mesh: THREE.SkinnedMesh, name: string, value: number) {
  const dict = mesh.morphTargetDictionary;
  const targets = mesh.morphTargetInfluences;
  if (!dict || !targets) return;
  const index = dict[name];
  if (index === undefined) return;
  targets[index] = value;
}

// Degrees of deflection that map to a full ARKit eye-look morph. 5° made every
// tiny saccade a full-range eye dart; 15° keeps saccades subtle while leaving
// room for the constant look-at-camera bias.
const GAZE_RANGE_DEG = 15;

function applyEyeGaze(meshes: THREE.SkinnedMesh[], yaw: number, pitch: number) {
  const clamped = (v: number) => Math.max(-1, Math.min(1, v / (GAZE_RANGE_DEG * DEG)));
  const y = clamped(yaw);
  const p = clamped(pitch);
  const up = Math.max(0, p);
  const down = Math.max(0, -p);
  const inL = Math.max(0, -y);
  const outL = Math.max(0, y);
  const inR = Math.max(0, y);
  const outR = Math.max(0, -y);

  for (const mesh of meshes) {
    setMorph(mesh, 'eyeLookUpLeft', up);
    setMorph(mesh, 'eyeLookDownLeft', down);
    setMorph(mesh, 'eyeLookInLeft', inL);
    setMorph(mesh, 'eyeLookOutLeft', outL);
    setMorph(mesh, 'eyeLookUpRight', up);
    setMorph(mesh, 'eyeLookDownRight', down);
    setMorph(mesh, 'eyeLookInRight', inR);
    setMorph(mesh, 'eyeLookOutRight', outR);
  }
}

interface BoneRest {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

export interface BakedAlignment {
  characters: readonly string[];
  character_start_times_seconds: readonly number[];
  character_end_times_seconds: readonly number[];
}

interface LipShape {
  jawOpen: number;
  mouthClose: number;
  mouthSmileLeft: number;
  mouthSmileRight: number;
  mouthFunnel: number;
  mouthPucker: number;
}

const LIP_ZERO: LipShape = {
  jawOpen: 0,
  mouthClose: 0,
  mouthSmileLeft: 0,
  mouthSmileRight: 0,
  mouthFunnel: 0,
  mouthPucker: 0,
};

/** Target mouth pose for one aligned character. Word gaps return LIP_ZERO so
 * the mouth relaxes between words; quick characters articulate less than held
 * ones so fast speech doesn't flap the jaw full-range. */
function lipShapeForChar(c: string, span: number): LipShape {
  if (!/[a-zA-Z]/.test(c)) return LIP_ZERO;
  const isVowel = /^[aeiouAEIOU]$/.test(c);
  const isRounded = /^[oOuUwW]$/.test(c);
  const isSmile = /^[eEiI]$/.test(c);
  const isClosed = /^[bmpBMP]$/.test(c);
  const isNarrow = /^[szSZfFvV]$/.test(c);
  const held = Math.max(0.55, Math.min(1, span / 0.09));
  const jaw = isClosed ? 0 : isNarrow ? 0.05 : isVowel ? 0.42 * held : 0.16;
  return {
    jawOpen: jaw,
    mouthClose: isClosed ? 0.5 : 0,
    mouthSmileLeft: isSmile ? 0.3 : 0,
    mouthSmileRight: isSmile ? 0.3 : 0,
    mouthFunnel: isRounded ? 0.55 * held : 0,
    mouthPucker: isRounded ? 0.35 * held : 0,
  };
}

interface NatalieModelProps {
  action: string | null;
  audioDuration: number | null;
  audioRef: MutableRefObject<HTMLAudioElement | null>;
  alignment: BakedAlignment | null;
  reducedMotion: boolean;
  onCaptionChange: (caption: string) => void;
  onActionComplete: () => void;
}

function NatalieModel({
  action,
  audioDuration,
  audioRef,
  alignment,
  reducedMotion,
  onCaptionChange,
  onActionComplete,
}: NatalieModelProps) {
  const { scene } = useGLTF(MODEL_URL, DRACO_DECODER) as {
    scene: THREE.Group;
  };

  const meshes = useMemo<THREE.SkinnedMesh[]>(() => {
    const out: THREE.SkinnedMesh[] = [];
    scene.traverse((child) => {
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
        out.push(child as THREE.SkinnedMesh);
      }
    });
    return out;
  }, [scene]);

  const bonesRef = useRef<Record<string, THREE.Bone | null>>({});
  const restPoseRef = useRef<Map<THREE.Bone, BoneRest>>(new Map());

  useEffect(() => {
    const map: Record<string, THREE.Bone | null> = {};
    for (const [key, name] of Object.entries(BONE_NAMES)) {
      map[key] = (scene.getObjectByName(name) as THREE.Bone) ?? null;
    }
    bonesRef.current = map;

    const rest = new Map<THREE.Bone, BoneRest>();
    for (const bone of Object.values(map)) {
      if (!bone) continue;
      rest.set(bone, {
        position: bone.position.clone(),
        rotation: bone.rotation.clone(),
        scale: bone.scale.clone(),
        quaternion: bone.quaternion.clone(),
      });
    }
    restPoseRef.current = rest;
  }, [scene]);

  const engineRef = useRef(new IdleEngine(12345));
  const actionRef = useRef<string | null>(null);
  const actionTimeRef = useRef(0);
  const lipStateRef = useRef<LipShape>({ ...LIP_ZERO });

  useEffect(() => {
    // Start from a clean ARKit neutral pose.
    for (const mesh of meshes) {
      const targets = mesh.morphTargetInfluences;
      if (targets) targets.fill(0);
    }
  }, [meshes]);

  useEffect(() => {
    scene.traverse((child) => {
      const obj = child as THREE.Object3D & { frustumCulled?: boolean };
      if (obj.type === 'SkinnedMesh') obj.frustumCulled = false;
    });
  }, [scene]);

  useEffect(() => {
    const next = action && PRESENCE_ACTIONS[action] ? action : null;
    if (next === actionRef.current) return;
    actionRef.current = next;
    actionTimeRef.current = 0;
    onCaptionChange(next ? PRESENCE_ACTIONS[next]!.caption : '');
  }, [action, onCaptionChange]);

  const targetLipFromTime = (t: number): LipShape => {
    if (!alignment || alignment.characters.length === 0) return LIP_ZERO;
    const a = alignment;
    const starts = a.character_start_times_seconds;
    const ends = a.character_end_times_seconds;
    const chars = a.characters;

    // The bake prepends Eleven style tags like `[warmly] ` to the spoken text.
    // These are not voiced, so we skip them for lip sync. Fallback caption
    // alignments carry no tag, so only skip when one is actually present.
    let startIndex = 0;
    if (chars[0] === '[') {
      while (startIndex < chars.length && chars[startIndex] !== ']') startIndex += 1;
      if (startIndex < chars.length) startIndex += 1;
    }
    const firstSpokenIndex = startIndex;

    let i = firstSpokenIndex;
    while (i < chars.length && ends[i]! < t) i += 1;
    if (i < firstSpokenIndex || i >= chars.length) {
      // During the tag or after the final character, keep the mouth closed.
      return LIP_ZERO;
    }
    // Co-articulation: hold this character's shape, then glide into the next
    // one over the back half of its span. The mouth flows shape-to-shape and
    // never snaps shut between letters — the old per-character sine envelope
    // read as laggy puppet flutter once it went through the smoother.
    const tStart = starts[i] ?? 0;
    const tEnd = ends[i] ?? tStart;
    const span = Math.max(0.02, tEnd - tStart);
    const local = Math.max(0, Math.min(1, (t - tStart) / span));
    const cur = lipShapeForChar(chars[i] ?? ' ', span);
    const nextSpan = Math.max(0.02, (ends[i + 1] ?? 0) - (starts[i + 1] ?? 0));
    const next = i + 1 < chars.length ? lipShapeForChar(chars[i + 1] ?? ' ', nextSpan) : LIP_ZERO;
    const f = local < 0.5 ? 0 : (local - 0.5) * 2;
    const blend = f * f * (3 - 2 * f);
    const out = { ...LIP_ZERO };
    for (const key of Object.keys(LIP_ZERO) as (keyof LipShape)[]) {
      out[key] = cur[key] + (next[key] - cur[key]) * blend;
    }
    return out;
  };

  const tmpEyeMid = useRef(new THREE.Vector3());
  const tmpEyeR = useRef(new THREE.Vector3());
  const tmpToCamera = useRef(new THREE.Vector3());

  useFrame((state, rawDelta) => {
    const delta = reducedMotion ? 0 : Math.min(rawDelta, 0.05);
    const active = actionRef.current
      ? PRESENCE_ACTIONS[actionRef.current]
      : null;

    const playDuration =
      (active
        ? (audioRef.current?.duration ?? audioDuration ?? active.duration)
        : null) || active?.duration || 1;

    // Follow the audio clock when it is available; otherwise fall back to frame time.
    const now = audioRef.current ? audioRef.current.currentTime : actionTimeRef.current + delta;

    if (active && now >= playDuration) {
      actionRef.current = null;
      actionTimeRef.current = 0;
      onActionComplete();
      onCaptionChange('');
      return;
    }

    const inputs = active ? active.inputs : IDLE_INPUTS;
    const frame = engineRef.current.step(delta, inputs);

    actionTimeRef.current = now;
    const env =
      active && playDuration > 0
        ? Math.max(0, Math.sin((now / playDuration) * Math.PI))
        : 0;

    // --- lip sync from alignment (baked audio, or the caption fallback) ---
    // Deliberately NOT scaled by `env`: that whole-clip envelope belongs to the
    // gesture morphs. Applying it to speech kept the mouth nearly shut for the
    // first and last third of every line.
    const targetLip =
      !reducedMotion && active && alignment ? targetLipFromTime(now) : LIP_ZERO;
    // Asymmetric smoothing, like real articulation: the mouth snaps toward a
    // shape (~22ms) and relaxes out of it more slowly (~60ms). A symmetric
    // low-pass here made every shape land late and mushy.
    const rise = 1 - Math.exp(-rawDelta * 45);
    const fall = 1 - Math.exp(-rawDelta * 16);
    const lip = lipStateRef.current;
    for (const key of Object.keys(LIP_ZERO) as (keyof LipShape)[]) {
      const target = targetLip[key];
      lip[key] += (target - lip[key]) * (target > lip[key] ? rise : fall);
    }

    // --- morph targets ---
    for (const mesh of meshes) {
      const targets = mesh.morphTargetInfluences;
      if (targets) targets.fill(0);

      setMorph(mesh, 'eyeBlinkLeft', frame.eyeBlinkLeft);
      setMorph(mesh, 'eyeBlinkRight', frame.eyeBlinkRight);
      setMorph(mesh, 'eyeWideLeft', frame.eyesWide);
      setMorph(mesh, 'eyeWideRight', frame.eyesWide);

      if (active) {
        for (const [name, value] of Object.entries(active.morphs)) {
          setMorph(mesh, name, value * env);
        }
      }

      // Speech shapes are added on top of the gesture pose, not written over it
      // — the old overwrite erased the action's smile whenever she spoke.
      setMorph(mesh, 'jawOpen', lip.jawOpen + (active?.morphs.jawOpen ?? 0) * 0.5 * env);
      setMorph(mesh, 'mouthClose', lip.mouthClose);
      setMorph(
        mesh,
        'mouthSmileLeft',
        lip.mouthSmileLeft + (active?.morphs.mouthSmileLeft ?? 0) * env
      );
      setMorph(
        mesh,
        'mouthSmileRight',
        lip.mouthSmileRight + (active?.morphs.mouthSmileRight ?? 0) * env
      );
      setMorph(mesh, 'mouthFunnel', lip.mouthFunnel);
      setMorph(mesh, 'mouthPucker', lip.mouthPucker);
    }

    // --- eye contact: bias the gaze at the viewer's camera, saccades on top ---
    // Without this the eyes saccade around the model's neutral forward axis,
    // which points past the lens — the "staring into space" look.
    const bones = bonesRef.current;
    let gazeYaw = frame.eyeYaw;
    let gazePitch = frame.eyePitch;
    const eyeAnchor = bones.eyeL ?? bones.head;
    if (eyeAnchor) {
      eyeAnchor.getWorldPosition(tmpEyeMid.current);
      if (bones.eyeL && bones.eyeR) {
        bones.eyeR.getWorldPosition(tmpEyeR.current);
        tmpEyeMid.current.add(tmpEyeR.current).multiplyScalar(0.5);
      }
      const d = tmpToCamera.current.copy(state.camera.position).sub(tmpEyeMid.current);
      // The model faces +Z toward the camera, so face space ≈ world space here.
      gazeYaw += Math.atan2(d.x, d.z);
      gazePitch += Math.atan2(d.y, Math.hypot(d.x, d.z));
    }
    applyEyeGaze(meshes, gazeYaw, gazePitch);

    // --- body: stable root/pelvis, subtle chest breath, tiny neck drift ---
    const restPose = restPoseRef.current;
    const chest = bones.chest;
    if (chest && restPose.has(chest)) {
      const rest = restPose.get(chest)!;
      chest.position.copy(rest.position);
      chest.rotation.copy(rest.rotation);
      chest.scale.copy(rest.scale);
      // Breathing is barely visible: a tiny chest pitch and Y lift.
      chest.rotation.x = rest.rotation.x + frame.breathY * 10;
      chest.position.y = rest.position.y + frame.breathY * 0.08;
    }

    for (const side of ['L', 'R'] as const) {
      const shoulder = side === 'L' ? bones.shoulderL : bones.shoulderR;
      if (shoulder && restPose.has(shoulder)) {
        const rest = restPose.get(shoulder)!;
        shoulder.position.copy(rest.position);
        shoulder.rotation.copy(rest.rotation);
        shoulder.scale.copy(rest.scale);
        const zSign = side === 'L' ? 1 : -1;
        shoulder.rotation.z =
          rest.rotation.z + frame.breathY * 0.5 * zSign;
      }
    }

    const neck = bones.neck;
    if (neck && restPose.has(neck)) {
      const rest = restPose.get(neck)!;
      neck.position.copy(rest.position);
      neck.rotation.copy(rest.rotation);
      neck.scale.copy(rest.scale);
      // Irregular drift + backchannel nods. The engine's drift is already in
      // radians (max ~0.3°); the old 0.03 factor scaled it to 0.009° — frozen.
      neck.rotation.y = rest.rotation.y + frame.driftYaw * 1.2;
      neck.rotation.x = rest.rotation.x + frame.driftPitch * 1.2 + frame.nodPitch * 0.5;
      if (active?.neck) {
        neck.rotation.x += (active.neck.x ?? 0) * env;
        neck.rotation.y += (active.neck.y ?? 0) * env;
      }
    }

    const head = bones.head;
    if (head && restPose.has(head)) {
      const rest = restPose.get(head)!;
      head.position.copy(rest.position);
      head.rotation.copy(rest.rotation);
      head.scale.copy(rest.scale);
      // Head stays conversationally stable: subtle drift, the rest of the nod,
      // and a light jaw coupling so the chin dips with open vowels while she
      // speaks — the strongest single cue that the face and voice are one.
      head.rotation.y = rest.rotation.y + frame.driftYaw * 0.8;
      head.rotation.x =
        rest.rotation.x +
        frame.driftPitch * 0.8 +
        frame.nodPitch * 0.5 +
        lip.jawOpen * 0.05;
      if (active?.head) {
        head.rotation.x += (active.head.x ?? 0) * env;
        head.rotation.y += (active.head.y ?? 0) * env;
        head.rotation.z += (active.head.z ?? 0) * env;
      }
    }

    // Root, pelvis and the overall group are intentionally left at rest.
  });

  return (
    <group>
      <primitive object={scene} />
    </group>
  );
}

function CameraSetup() {
  const { camera } = useThree();
  useEffect(() => {
    camera.lookAt(...LOOK_AT);
  }, [camera]);
  return null;
}

interface NatalieSceneProps {
  action?: string | null;
  audioDuration?: number | null;
  audioRef?: MutableRefObject<HTMLAudioElement | null>;
  alignment?: BakedAlignment | null;
  reducedMotion?: boolean;
  onCaptionChange?: (caption: string) => void;
  onActionComplete?: () => void;
}

export function NatalieScene({
  action = null,
  audioDuration = null,
  audioRef,
  alignment = null,
  reducedMotion = false,
  onCaptionChange,
  onActionComplete,
}: NatalieSceneProps) {
  return (
    <Canvas
      camera={{ fov: CAMERA_FOV, position: CAMERA_POS, near: 0.1, far: 10 }}
      gl={{ antialias: false, alpha: true }}
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      <CameraSetup />
      <hemisphereLight
        color="#FFF8F2"
        groundColor="#4A3B36"
        intensity={1.0}
      />
      <ambientLight intensity={0.6} color="#FFF6ED" />
      <directionalLight
        position={[1.2, 2.5, 1.8]}
        intensity={1.2}
        color="#FFF0E0"
      />
      <directionalLight
        position={[-1.2, 1.2, 1.5]}
        intensity={0.5}
        color="#E0F0FF"
      />
      <directionalLight
        position={[0, -1.0, 1.0]}
        intensity={0.4}
        color="#FFE8D6"
      />
      <pointLight
        position={[0, 0.7, 1.0]}
        intensity={0.6}
        color="#FFF0E0"
        distance={2.5}
        decay={2}
      />
      <NatalieModel
        action={action}
        audioDuration={audioDuration}
        audioRef={audioRef ?? { current: null }}
        alignment={alignment ?? null}
        reducedMotion={reducedMotion}
        onCaptionChange={onCaptionChange ?? (() => {})}
        onActionComplete={onActionComplete ?? (() => {})}
      />
    </Canvas>
  );
}

export default NatalieScene;
