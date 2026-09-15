'use client';
// Natalie, in the room — the same performance the 2D pane plays, on the
// renderer the headset actually runs.
//
// SAME SIGNALS, DIFFERENT SURFACE, and that sentence is load-bearing. Her
// voice is the audio queue, which lives outside React and plays regardless of
// which renderer is looking at it — entering the headset opens no second
// audio stream. Her face is `audioQueue.sampleFace()`, the A2F frame for the
// playing instant — the identical read the WebGPU stage makes. Her idle body
// is `IdleEngine`, the same seeded engine, driven here through the moyo.2
// fork's bone seam (`setSkeletonBoneTransforms`) instead of three.js bones.
// Nothing here can start, stop or seek the voice: every read is a sampler.
//
// THE LOOP IS IMPERATIVE AND RENDERS NOTHING. 30 Hz, one `setMorphTargetWeights`
// and one `setSkeletonBoneTransforms` per tick, both fire-and-forget native
// calls — zero React renders per frame, which is what lets her live inside a
// scene that must not re-render at frame rate. The mount is once per scene:
// this component sits in the Viro scene tree, so props cannot update it after
// the navigator's constructor capture anyway — everything live arrives through
// the samplers.
//
// A FAILURE IS ABSENCE, NOT AN ERROR. A binary without the bone seam, a model
// that fails to load, a skeleton missing the named bones — each one quietly
// degrades: no bones means face-only, no face means idle blinks, no model
// means nothing mounts and the chat panel still speaks for her. A child is
// never shown a renderer's bad day (the rule `tutor-avatar-3d` already keeps).
// SOT: packages/app/features/tutor/natalie-spatial-pose.ts · packages/app/features/tutor/tutor-audio.ts
//      docs/decisions/adr-117-spatial-whiteboard-bridge.md (moyo.2 amendment)
// SOT-KEYWORDS: natalie xr viro 3d object avatar bones morph face idle spatial glb presence

import { useEffect, useRef } from 'react';
import { Viro3DObject, ViroNode } from '@reactvision/react-viro';
import { IdleEngine, type IdleInputs } from '@acme/avatar';
import { natalieMorphs, type NatalieMorph } from '@acme/ui/xr';
import { audioQueue } from './tutor-audio';
import {
  SPATIAL_POSE_BONES,
  spatialPose,
  type SpatialIdleView,
} from './natalie-spatial-pose';

/*
  THE VIRO CUT, BUILT FROM THE ASSET THE 2D STAGE ALREADY RENDERS. The marketing
  GLB declares `extensionsRequired: ["EXT_texture_webp"]` — every texture is
  WebP, two of them 8K — and tinygltf refuses any file whose REQUIRED extension
  it cannot satisfy, so ViroCore's loader failed before the first vertex
  (measured on the PICO: `onError "Failed to load model"`). This cut is the
  same mesh, skin and 52 morphs with the textures transcoded to PNG at 2048 and
  the webp requirement dropped. One file, so it survives release asset
  flattening — the hazard the 2D stage's split .gltf exists to dodge on Dawn.
*/
// eslint-disable-next-line @typescript-eslint/no-require-imports
const NATALIE_GLB = require('@acme/avatar/assets/natalie-viro.glb');

const TICK_MS = 33;

/*
  Off until the rest-pose read and the pose math are confirmed on device. When
  false she stands in her loaded rest pose with a live face — which is the
  correct thing to ship while the idle body is unverified, and the isolation
  that tells render-correctness apart from pose-correctness.
*/
const BODY_DRIVE_ENABLED = false;

/** Idle channels at rest, for the frames before the engine has stepped. */
const STILL: SpatialIdleView = {
  breathY: 0,
  breathPitch: 0,
  swayX: 0,
  swayY: 0,
  driftYaw: 0,
  driftPitch: 0,
  nodPitch: 0,
};

export interface XrNatalieProps {
  /** Her feet, in world metres. The screen derives it from the child's head. */
  position: [number, number, number];
  /** Yaw only — she stands upright, turned to face the child. */
  rotationY: number;
}

export function XrNatalie({ position, rotationY }: XrNatalieProps) {
  const model = useRef<Viro3DObject>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (__DEV__) console.log('[natalie-xr] mounted at', position, 'yaw', rotationY.toFixed(1));
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    /* Deterministic idle — the default seed, same as the 2D stage's bus. */
    const engine = new IdleEngine();
    let previousMorphs: readonly NatalieMorph[] = [];
    let restPose: number[] | null = null;
    let bonesLive = false;
    let lastTick = Date.now();

    const start = async () => {
      const handle = model.current;
      if (handle === null) return;

      /*
        The rest pose, read once. `getSkeletonBoneTransforms` is a moyo.2
        method — on an older binary the native module lacks it and this throws,
        which is the face-only degradation, not a failure to surface.
      */
      try {
        const { matrices } = await handle.getSkeletonBoneTransforms([...SPATIAL_POSE_BONES]);
        const settled = matrices.length === SPATIAL_POSE_BONES.length * 16;
        const legible = settled && SPATIAL_POSE_BONES.every((_, i) => matrices[i * 16] !== 0 || matrices[i * 16 + 1] !== 0 || matrices[i * 16 + 2] !== 0);
        if (__DEV__) console.log('[natalie-xr] rest pose read:', settled ? 'ok' : 'wrong-length', 'legible:', legible, 'first-row:', matrices.slice(0, 4));
        /*
          BONE DRIVING IS GATED OFF UNTIL THE REST POSE IS PROVEN ON DEVICE.
          A wrong bone-world matrix does not fail — it scales or shears the mesh
          into a wall of geometry ("all I can see is her eyes"). She renders in
          her loaded rest pose first; the idle body turns on only once the rest
          read is confirmed sane in the headset. Face morphs stay live — they
          are clamped 0..1 and cannot deform geometry scale.
        */
        if (legible && BODY_DRIVE_ENABLED) {
          restPose = matrices;
          bonesLive = true;
        }
      } catch (e) {
        if (__DEV__) console.log('[natalie-xr] rest pose read FAILED', String(e));
        bonesLive = false;
      }
      if (cancelled) return;

      timer = setInterval(() => {
        const handleNow = model.current;
        if (handleNow === null) return;
        const now = Date.now();
        const dt = Math.min((now - lastTick) / 1000, 0.1);
        lastTick = now;

        const speaking = audioQueue.isSpeaking();
        const onset = audioQueue.timeUntilOnset();
        const inputs: IdleInputs = {
          speechActive: speaking,
          speechGap: false,
          processing: false,
          partnerSpeaking: false,
          partnerPauseEvent: false,
          partnerF0Falling: false,
          timeUntilOnset: onset ?? Number.POSITIVE_INFINITY,
        };
        const frame = engine.step(dt, inputs);

        /*
          THE FACE. During speech the A2F frame is the whole mouth; the idle
          engine's lids and gaze layer under it. The engine's channels only
          become morphs here — blink and eye direction — because the full
          expression encoder belongs to the face bus, and one filter
          (`natalieMorphs`) decides what is worth a bridge crossing.
        */
        const face = audioQueue.sampleFace() ?? {};
        const shape: Record<string, number> = {
          eyeBlinkLeft: frame.eyeBlinkLeft,
          eyeBlinkRight: frame.eyeBlinkRight,
          ...face,
        };
        if (face.jawOpen === undefined && speaking) {
          const sample = audioQueue.sampleSpeech(now);
          if (sample.active) shape.jawOpen = sample.shape.jawOpen ?? 0;
        }
        const morphs = natalieMorphs(shape, previousMorphs);
        if (morphs !== previousMorphs) {
          previousMorphs = morphs;
          handleNow.setMorphTargetWeights(
            morphs.map((entry) => entry.target),
            morphs.map((entry) => entry.weight),
          );
        }

        /* THE BODY — only when the seam and the skeleton both answered. */
        if (bonesLive && restPose !== null) {
          const view: SpatialIdleView = {
            breathY: frame.breathY,
            breathPitch: frame.breathPitch,
            swayX: frame.swayX,
            swayY: frame.swayY,
            driftYaw: frame.driftYaw,
            driftPitch: frame.driftPitch,
            nodPitch: frame.nodPitch,
          };
          handleNow.setSkeletonBoneTransforms(
            [...SPATIAL_POSE_BONES],
            spatialPose(restPose, view),
            true,
          );
        }
      }, TICK_MS);
    };

    /* Poll for load: onLoadEnd sets the flag; effects cannot await a prop. */
    const waitForLoad = setInterval(() => {
      if (!loaded.current) return;
      clearInterval(waitForLoad);
      void start();
    }, 100);

    return () => {
      cancelled = true;
      clearInterval(waitForLoad);
      if (timer !== null) clearInterval(timer);
    };
  }, []);

  return (
    <ViroNode position={position} rotation={[0, rotationY, 0]}>
      <Viro3DObject
        ref={model}
        source={NATALIE_GLB}
        type="GLB"
        onLoadStart={() => {
          if (__DEV__) console.log('[natalie-xr] model load started');
        }}
        onLoadEnd={() => {
          loaded.current = true;
          if (__DEV__) console.log('[natalie-xr] model load ENDED — she should be visible');
        }}
        onError={(event) => {
          /* Absence is the contract, but a silent absence is undebuggable. */
          console.log('[natalie-xr] model FAILED to load', JSON.stringify(event?.nativeEvent ?? {}));
        }}
        /*
          Her presence must not eat the pointer: a ray that hits her instead of
          the drag quad is a stroke that never starts.
        */
        ignoreEventHandling
      />
    </ViroNode>
  );
}
