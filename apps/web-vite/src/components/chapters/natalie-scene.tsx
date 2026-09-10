'use client';
/**
 * The real-time 3D Natalie scene for Chapter 05. Loads the waist-up Humano GLB
 * and uses the same rig writer as native and web tutoring: posture, fingers,
 * head/eye coordination and conservative speech-driven gestures.
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
import { createHumanoPresence } from '@acme/avatar/body';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

const MODEL_URL = '/models/humano-marketing.glb';
const DRACO_DECODER = '/draco/';

const CAMERA_FOV = 38;
const CAMERA_POS: [number, number, number] = [0, 1.45, 1.15];
const LOOK_AT: [number, number, number] = [0, 1.5, 0];

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
  mouthLowerDownLeft: number;
  mouthLowerDownRight: number;
  mouthUpperUpLeft: number;
  mouthUpperUpRight: number;
  mouthStretchLeft: number;
  mouthStretchRight: number;
}

const LIP_ZERO: LipShape = {
  jawOpen: 0,
  mouthClose: 0,
  mouthSmileLeft: 0,
  mouthSmileRight: 0,
  mouthFunnel: 0,
  mouthPucker: 0,
  mouthLowerDownLeft: 0,
  mouthLowerDownRight: 0,
  mouthUpperUpLeft: 0,
  mouthUpperUpRight: 0,
  mouthStretchLeft: 0,
  mouthStretchRight: 0,
};

/** Target mouth pose for one aligned character. Word gaps return LIP_ZERO so
 * the mouth relaxes between words; quick characters articulate less than held
 * ones so fast speech doesn't flap the jaw full-range. jawOpen alone reads as
 * a ventriloquist dummy — the lip morphs (lowerDown/upperUp/stretch) are what
 * expose teeth and make the shapes legible. */
function lipShapeForChar(c: string, span: number): LipShape {
  if (!/[a-zA-Z]/.test(c)) return LIP_ZERO;
  const held = Math.max(0.55, Math.min(1, span / 0.09));
  const shape = { ...LIP_ZERO };
  if (/^[aA]$/.test(c)) {
    // Wide open vowel — the big visible one.
    shape.jawOpen = 0.68 * held;
    shape.mouthLowerDownLeft = 0.42 * held;
    shape.mouthLowerDownRight = 0.42 * held;
    shape.mouthUpperUpLeft = 0.25 * held;
    shape.mouthUpperUpRight = 0.25 * held;
    shape.mouthStretchLeft = 0.18;
    shape.mouthStretchRight = 0.18;
  } else if (/^[eEiI]$/.test(c)) {
    // Spread vowel — corners wide, teeth showing.
    shape.jawOpen = 0.34 * held;
    shape.mouthSmileLeft = 0.38;
    shape.mouthSmileRight = 0.38;
    shape.mouthUpperUpLeft = 0.22 * held;
    shape.mouthUpperUpRight = 0.22 * held;
    shape.mouthLowerDownLeft = 0.2 * held;
    shape.mouthLowerDownRight = 0.2 * held;
  } else if (/^[oOuUwW]$/.test(c)) {
    // Rounded vowel.
    shape.jawOpen = 0.45 * held;
    shape.mouthFunnel = 0.6 * held;
    shape.mouthPucker = 0.4 * held;
  } else if (/^[bmpBMP]$/.test(c)) {
    // Bilabial press.
    shape.mouthClose = 0.55;
    shape.mouthPucker = 0.1;
  } else if (/^[szSZfFvV]$/.test(c)) {
    // Narrow fricative — teeth together.
    shape.jawOpen = 0.08;
    shape.mouthUpperUpLeft = 0.12;
    shape.mouthUpperUpRight = 0.12;
  } else {
    // Everything else articulates as a mid consonant.
    shape.jawOpen = 0.22 * held;
    shape.mouthLowerDownLeft = 0.14 * held;
    shape.mouthLowerDownRight = 0.14 * held;
  }
  return shape;
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
  const { scene: source } = useGLTF(MODEL_URL, DRACO_DECODER) as {
    scene: THREE.Group;
  };
  // GLTF caches its scene. Clone the skeleton so two surfaces cannot animate
  // each other's bones, and capture rest only once for this instance.
  const scene = useMemo(() => clone(source), [source]);
  const presence = useMemo(() => createHumanoPresence(scene), [scene]);
  const actionRef = useRef<string | null>(null);
  const actionTimeRef = useRef(0);
  const lipStateRef = useRef<LipShape>({ ...LIP_ZERO });
  useEffect(() => () => presence.rest(), [presence]);

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
    if (t < tStart) return LIP_ZERO;
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

  useFrame((state, rawDelta) => {
    const delta = Math.max(0, Math.min(rawDelta, 0.05));
    const active = actionRef.current ? PRESENCE_ACTIONS[actionRef.current] : null;
    const audio = audioRef.current;
    const duration = audio?.duration ?? audioDuration;
    const playDuration = duration && Number.isFinite(duration) && duration > 0
      ? duration : active?.duration ?? 1;
    // Caption-only actions still finish in reduced motion. They never pretend
    // to speak; articulation is gated by actual playback, not the button state.
    const now = audio ? audio.currentTime : actionTimeRef.current + delta;
    actionTimeRef.current = now;
    if (active && (now >= playDuration || audio?.ended)) {
      actionRef.current = null;
      actionTimeRef.current = 0;
      onActionComplete();
      onCaptionChange('');
    }
    const speaking = Boolean(active && audio && !audio.paused && !audio.ended && now < playDuration);
    const env = active && now < playDuration
      ? Math.max(0, Math.sin((now / playDuration) * Math.PI)) : 0;
    const target = speaking && alignment ? targetLipFromTime(now) : LIP_ZERO;
    const rise = 1 - Math.exp(-delta * 45);
    const fall = 1 - Math.exp(-delta * 16);
    const lip = lipStateRef.current;
    for (const key of Object.keys(LIP_ZERO) as (keyof LipShape)[]) {
      lip[key] += (target[key] - lip[key]) * (target[key] > lip[key] ? rise : fall);
    }
    const emotion: Record<string, number> = {};
    for (const [name, value] of Object.entries(active?.morphs ?? {})) {
      // An action smile can remain, but a caption cannot open the jaw.
      if (name !== 'jawOpen') emotion[name] = value * env;
    }
    presence.step(delta, {
      speaking,
      phase: speaking ? 'speaking' : 'waiting',
      mouth: lip.jawOpen,
      face: speaking ? { ...lip } : null,
      emotion,
      reducedMotion,
      cameraPosition: state.camera.position,
    });
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
