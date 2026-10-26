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

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Viro3DObject, ViroAnimations, ViroNode, ViroSpinner } from '@reactvision/react-viro';
import { IdleEngine, type IdleInputs } from '@acme/avatar';
import { XR_MATERIAL, natalieMorphs, type NatalieMorph } from '@acme/ui/xr';
import { audioQueue } from './tutor-audio';
import { viroFace } from './natalie-viro-targets.ts';
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
  same identity and skin with six XR morph channels with the textures transcoded to PNG at 2048 and
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

export interface XrNatalieProps {
  /** Her feet, in world metres. The screen derives it from the child's head. */
  position: [number, number, number];
  /** Yaw only — she stands upright, turned to face the child. */
  rotationY: number;
  /* Rendered height in cm — the GLB is 1.673 m at scale 1. VR undersells
     stature at slot distance, so callers dial it per scene rather than
     trusting the authored measure. */
  heightCm?: number;
  active?: boolean;
  listening?: boolean;
  processing?: boolean;
  onStatus?: (status: 'loading' | 'ready' | 'failed') => void;
}


/** 5'6", and the number the scene draws her at. */
const NATALIE_HEIGHT_CM = 167.6;

/*
  SHE STANDS ON THE FLOOR, ALWAYS. With `trackingOrigin="floor"` world y = 0 is
  the real floor, and her node's origin is her feet. Dragging is on the floor
  plane, so no grab can lift her, and the release keeps y at 0.
*/
const FLOOR_PLANE: { planePoint: [number, number, number]; planeNormal: [number, number, number]; maxDistance: number } = {
  planePoint: [0, 0, 0],
  planeNormal: [0, 1, 0],
  maxDistance: 10,
};

/*
  HER ARRIVAL. While the GLB loads, a spinner lies flat on the floor where she
  will stand; when it lands she grows up out of it. The node's origin is her
  feet, so scaling it reads as rising from the floor, not swelling in mid-air.
  Animated from 0.01, never 0: a zero scale is a degenerate matrix, and the
  fork culls prop-zero nodes for good (memory: viro fork opacity rules).
*/
ViroAnimations.registerAnimations({
  natalieHidden: { properties: { scaleX: 0.01, scaleY: 0.01, scaleZ: 0.01 }, duration: 1 },
  natalieArrive: { properties: { scaleX: 1, scaleY: 1, scaleZ: 1 }, duration: 700, easing: 'EaseOut' },
});
/** About her shoulder width, flat on the floor. */
const ARRIVAL_SPINNER_SCALE = 0.45;
/* The spinner IS the placement animation, so it plays this long AFTER the
   model loads. Timed from mount it was spent while the immersive session was
   still opening, and a cached GLB finished before anyone could see it. */
const ARRIVAL_SPIN_MS = 2500;

export function XrNatalie({ position, rotationY, heightCm = NATALIE_HEIGHT_CM, onStatus, active = true, listening = false, processing = false }: XrNatalieProps) {
  const model = useRef<Viro3DObject>(null);
  const [ready, setReady] = useState(false);
  const [arrived, setArrived] = useState(false);
  useEffect(() => {
    if (!ready) { setArrived(false); return; }
    const timer = setTimeout(() => setArrived(true), ARRIVAL_SPIN_MS);
    return () => clearTimeout(timer);
  }, [ready]);
  const signals = useRef({ active, listening, processing });
  useLayoutEffect(() => { signals.current = { active, listening, processing }; }, [active, listening, processing]);
  /*
    WHERE THE CHILD PUT HER, kept apart from where the composition placed her.
    Viro's drag MOVES THE DRAGGED NODE, and this node's position is a prop — so
    without holding the delta, the next render of the scene would snap her back
    to the arc mid-drag. Accumulated here and added to the placement, the way
    the premium panels hold their own `dragOffset`.
  */
  const [dragOffset, setDragOffset] = useState<[number, number, number]>([0, 0, 0]);
  const dragFrom = useRef<[number, number, number] | null>(null);

  useEffect(() => {
    if (!ready) return;
    let foreground = AppState.currentState === "active";
    const appState = AppState.addEventListener("change", (state) => { foreground = state === "active"; });
    let morphBusy = false;
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
        if (BODY_DRIVE_ENABLED) {
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
        }
      } catch (e) {
        if (__DEV__) console.log('[natalie-xr] rest pose read FAILED', String(e));
        bonesLive = false;
      }
      if (cancelled) return;

      timer = setInterval(() => {
        const handleNow = model.current;
        if (handleNow === null || !foreground || !signals.current.active) return;
        const now = Date.now();
        const dt = Math.min((now - lastTick) / 1000, 0.1);
        lastTick = now;

        const speaking = audioQueue.isSpeaking();
        const onset = audioQueue.timeUntilOnset();
        const inputs: IdleInputs = {
          speechActive: speaking,
          speechGap: false,
          processing: signals.current.processing,
          partnerSpeaking: signals.current.listening,
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
        const face = speaking ? audioQueue.sampleFace() ?? {} : {};
        const shape: Record<string, number> = {
          eyeBlinkLeft: frame.eyeBlinkLeft,
          eyeBlinkRight: frame.eyeBlinkRight,
          ...face,
        };
        if (face.jawOpen === undefined && speaking) {
          const sample = audioQueue.sampleSpeech(now);
          if (sample.active) shape.jawOpen = sample.shape.jawOpen ?? 0;
        }
        const morphs = natalieMorphs(viroFace(shape), previousMorphs);
        if (morphs !== previousMorphs && !morphBusy) {
          morphBusy = true;
          void Promise.resolve().then(() => {
            if (cancelled || !foreground || !signals.current.active) return;
            return handleNow.setMorphTargetWeights(
              morphs.map((entry) => entry.target), morphs.map((entry) => entry.weight),
            );
          }).then(() => { previousMorphs = morphs; })
            .catch(() => { /* A transient bridge failure retries the next frame. */ })
            .finally(() => { morphBusy = false; });
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

    void start();
    return () => {
      cancelled = true;
      appState.remove();
      if (timer !== null) clearInterval(timer);
    };
  }, [ready]);

  /*
    DRAGGABLE, like the panels. `FixedDistance` keeps her at the radius the ray
    grabbed her at, so a child slides her around themselves rather than pushing
    her into a wall — the same affordance the panels use, and the reason her
    NODE carries it rather than the model: dragging the Viro3DObject directly
    would move the mesh out of the node the drive loop writes to.
  */
  return (
    <ViroNode
      /* The GLB measures 1.673 m (POSITION bounds, audited 2026-09-26). Target
         height is a prop — a true 1.70 still read short in the headset (VR
         undersells stature at slot distance), so the default lands just over
         the ask rather than under it. */
      scale={[heightCm / 167.3, heightCm / 167.3, heightCm / 167.3]}
      position={[position[0] + dragOffset[0], 0, position[2] + dragOffset[2]]}
      rotation={[0, rotationY, 0]}
      dragType="FixedToPlane"
      dragPlane={FLOOR_PLANE}
      onDrag={(to: [number, number, number]) => { dragFrom.current = to; }}
      onClickState={(state: number) => {
        if (state !== 2 && state !== 3) return;
        const to = dragFrom.current;
        dragFrom.current = null;
        if (to) setDragOffset([to[0] - position[0], 0, to[2] - position[2]]);
      }}
    >
      <ViroSpinner
        type="light"
        materials={[XR_MATERIAL.spinner]}
        visible={!arrived}
        ignoreEventHandling
        /* Flat on the floor, a hair above it so it never z-fights the room. */
        position={[0, 0.005, 0]}
        rotation={[-90, 0, 0]}
        scale={[ARRIVAL_SPINNER_SCALE, ARRIVAL_SPINNER_SCALE, ARRIVAL_SPINNER_SCALE]}
      />
      <ViroNode animation={{ name: arrived ? 'natalieArrive' : 'natalieHidden', run: true }}>
      <Viro3DObject
        ref={model}
        source={NATALIE_GLB}
        type="GLB"
        onLoadStart={() => {
          setReady(false);
          onStatus?.('loading');
          if (__DEV__) console.log('[natalie-xr] model load started');
        }}
        onLoadEnd={() => {
          setReady(true);
          onStatus?.('ready');
          if (__DEV__) console.log('[natalie-xr] model load ENDED — she should be visible');
        }}
        onError={(event) => {
          setReady(false);
          onStatus?.('failed');
          /* Absence is the contract, but a silent absence is undebuggable. */
          console.log('[natalie-xr] model FAILED to load', JSON.stringify(event?.nativeEvent ?? {}));
        }}
        /*
          SHE IS HITTABLE, WHICH IS WHAT MAKES HER DRAGGABLE. This carried
          `ignoreEventHandling` so a ray meant for the board could not land on
          her — correct when she stood beside the paper, wrong now that she is
          58 deg off the arc and a child needs to grab her. A ray only starts a
          drag on a node it actually hits, and the parent node has no geometry
          of its own, so the model is what has to answer.
        */
        highAccuracyEvents={false}
      />
      </ViroNode>
    </ViroNode>
  );
}
