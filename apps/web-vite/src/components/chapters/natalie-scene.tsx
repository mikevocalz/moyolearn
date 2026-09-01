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

function applyEyeGaze(meshes: THREE.SkinnedMesh[], yaw: number, pitch: number) {
  const clamped = (v: number) => Math.max(-1, Math.min(1, v / (5 * DEG)));
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
  mouthSmileLeft: number;
  mouthSmileRight: number;
  mouthFunnel: number;
  mouthPucker: number;
}

const LIP_ZERO: LipShape = {
  jawOpen: 0,
  mouthSmileLeft: 0,
  mouthSmileRight: 0,
  mouthFunnel: 0,
  mouthPucker: 0,
};

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
    // These are not voiced, so we skip them for lip sync.
    let startIndex = 0;
    while (startIndex < chars.length && chars[startIndex] !== ']') startIndex += 1;
    if (startIndex < chars.length) startIndex += 1;
    const firstSpokenIndex = startIndex;

    let i = firstSpokenIndex;
    while (i < chars.length && ends[i]! < t) i += 1;
    if (i < firstSpokenIndex || i >= chars.length) {
      // During the tag or after the final character, keep the mouth closed.
      return LIP_ZERO;
    }
    const c = chars[i] ?? ' ';
    const tStart = starts[i] ?? 0;
    const tEnd = ends[i] ?? tStart;
    const span = Math.max(0.02, tEnd - tStart);
    const local = Math.max(0, Math.min(1, (t - tStart) / span));
    const attack = Math.sin(local * Math.PI); // soft open/close over the character
    const isVowel = /^[aeiouAEIOU]$/.test(c);
    const isRounded = /^[oOuUwW]$/.test(c);
    const isSmile = /^[eEiI]$/.test(c);
    const isClosed = /^[bmpBMP]$/.test(c);
    const isNarrow = /^[szSZfFvV]$/.test(c);
    const jaw = isClosed ? 0 : isNarrow ? 0.03 : isVowel ? 0.22 : 0.08;
    return {
      jawOpen: jaw * attack,
      mouthSmileLeft: isSmile ? 0.25 * attack : 0,
      mouthSmileRight: isSmile ? 0.25 * attack : 0,
      mouthFunnel: isRounded ? 0.35 * attack : 0,
      mouthPucker: isRounded ? 0.2 * attack : 0,
    };
  };

  useFrame((_, rawDelta) => {
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

    // --- lip sync from baked alignment ---
    const targetLip = active && audioRef.current && alignment ? targetLipFromTime(now) : LIP_ZERO;
    const rate = 1 - Math.exp(-rawDelta * 20);
    const lip = lipStateRef.current;
    for (const key of Object.keys(LIP_ZERO) as (keyof LipShape)[]) {
      lip[key] += (targetLip[key] - lip[key]) * rate;
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

      setMorph(mesh, 'jawOpen', (lip.jawOpen + (active?.morphs.jawOpen ?? 0) * 0.5) * env);
      setMorph(mesh, 'mouthSmileLeft', lip.mouthSmileLeft * env);
      setMorph(mesh, 'mouthSmileRight', lip.mouthSmileRight * env);
      setMorph(mesh, 'mouthFunnel', lip.mouthFunnel * env);
      setMorph(mesh, 'mouthPucker', lip.mouthPucker * env);
    }
    applyEyeGaze(meshes, frame.eyeYaw, frame.eyePitch);

    // --- body: stable root/pelvis, subtle chest breath, tiny neck drift ---
    const bones = bonesRef.current;
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
      // Very small, irregular neck adjustments — not continuous nodding.
      neck.rotation.y = rest.rotation.y + frame.driftYaw * 0.03;
      neck.rotation.x = rest.rotation.x + frame.driftPitch * 0.03;
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
      // Head stays conversationally stable; only minuscule drift.
      head.rotation.y = rest.rotation.y + frame.driftYaw * 0.015;
      head.rotation.x = rest.rotation.x + frame.driftPitch * 0.015;
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
