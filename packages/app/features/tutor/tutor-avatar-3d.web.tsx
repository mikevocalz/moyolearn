'use client';
/**
 * Natalie, rendered — the WEB half of ADR-111's stage.
 *
 * This is the same body, the same rig (`natalie-rig.ts`), the same presence
 * engine (`@acme/avatar/body`) and the same `WebGPURenderer` as
 * `tutor-avatar-3d.native.tsx`. What is NOT shared is everything that differs
 * between a Dawn surface and a DOM canvas, and that is the whole reason this is
 * a fork rather than a branch: on the browser side there is no
 * `react-native-webgpu`, no `present()`, no `unconfigure()`, no
 * `PixelRatio.get()`, and no Metro asset registry to resolve a `.gltf` through.
 *
 * FOUR THINGS THAT ARE DIFFERENT HERE, each of them deliberate:
 *
 *  1. THE MATERIAL STRIP IS SHARED, and that was a surprise. The native stage
 *     rebuilds every skinned material because Dawn throws on three's node graph
 *     for `KHR_materials_specular`/`anisotropy`/`ior`; the native file predicts
 *     the browser "has no such problem". Chrome's WebGPU has the same problem
 *     with the same asset — see `simplifySkinnedMaterials` below for the exact
 *     error — so the strip runs here too.
 *  2. NO `primeLoaderCache`. That exists because React Native's `fetch`
 *     polyfill cannot hand a `ReadableStream` body to three's `FileLoader`.
 *     A browser `Response` can, so `GLTFLoader` fetches its own `.bin` and
 *     textures the way it was written to.
 *  3. WEBGL2 IS A REAL FALLBACK, NOT A FAILURE. `navigator.gpu` is Chrome and
 *     Edge today; Safari and Firefox reach this code too. `forceWebGL` on a
 *     browser without WebGPU keeps her on screen instead of demoting a child
 *     to a monogram because of their parent's browser choice.
 *  4. `ResizeObserver`, NOT `onLayout`. Same job as the native `refit` — the
 *     drawing buffer does not follow the CSS box, so without this a pane
 *     toggle leaves her stretched.
 *
 * Everything else is held identical ON PURPOSE, because the contract above
 * this component is shared: `active` gates the loop rather than unmounting the
 * renderer, a failure calls `onUnavailable` and renders nothing so
 * `tutor-stage.ts` demotes to the 2D mark, and `sampleMouth`/`sampleFace` are
 * read-only inputs that can never affect her voice.
 *
 * The `<canvas>` is raw DOM rather than an `@acme/ui/html` primitive because it
 * is a render surface, not markup — there is no react-native-web element that
 * yields a WebGPU context.
 *
 * SOT: ./tutor-avatar-3d.native.tsx · ./natalie-rig.ts
 *      docs/decisions/adr-111-native-3d-runtime.md · packages/avatar/src/presence/humano.ts
 * SOT-KEYWORDS: natalie web 3d webgpu webgl fallback three gltf stage canvas resize observer
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EmotionState, type EmotionCategory, type Shape } from '@acme/avatar';
import { createHumanoPresence, frameBody, type HumanoPresence } from '@acme/avatar/body';
import { CAMERA_FOV, addRig } from './natalie-rig';
import type { TutorCues } from './tutor-cues';

/**
 * Where the split glTF is served from on the web.
 *
 * `apps/web/scripts/copy-avatar-assets.mjs` copies `natalie-phone/` out of
 * `@acme/avatar` into `public/natalie/` at build time. It is a COPY rather than
 * an import because the body is 13 MB across ten files that resolve each other
 * by relative path — handing that to a bundler produces either a broken `.bin`
 * lookup or a 13 MB chunk, and neither is a thing to debug twice.
 */
const BUNDLED_MODEL_URL = '/natalie/natalie.gltf';

/** Retina is worth it on a face; 3x on a 4K panel is not. */
const MAX_PIXEL_RATIO = 2;

/**
 * THE PRELOAD (ADR-114), the web's copy. Same contract as the native one: one
 * memoised promise for the fetch, the parse, the `.bin` and the texture
 * decodes, started by whoever gets there first and awaited by the stage. The
 * stage adopts the SAME scene graph; there is never a second parse.
 */
let preloaded: { uri: string; scene: Promise<THREE.Group> } | null = null;

export function preloadNatalie(modelUri?: string): Promise<THREE.Group> {
  const uri = modelUri ?? BUNDLED_MODEL_URL;
  if (preloaded && preloaded.uri === uri) return preloaded.scene;
  const scene = (async () => {
    const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
      new GLTFLoader().load(
        uri,
        (loaded) => resolve(loaded as unknown as { scene: THREE.Group }),
        undefined,
        (error) => reject(error instanceof Error ? error : new Error(String(error)))
      );
    });
    return gltf.scene;
  })();
  // A failed preload is forgotten, so the stage's own attempt is a real retry.
  scene.catch(() => {
    if (preloaded?.scene === scene) preloaded = null;
  });
  preloaded = { uri, scene };
  return scene;
}

export interface TutorAvatar3DProps {
  /**
   * False whenever she is not on screen — collapsed, a hidden pane, a
   * backgrounded tab. The renderer stays alive; the loop does not run.
   */
  active: boolean;
  isSpeaking: boolean;
  /** Mouth openness 0..1 at an audio-clock instant. Read-only by contract. */
  sampleMouth?: (nowMs: number) => number;
  /** Whether sound is coming out THIS FRAME. Preferred over `isSpeaking`. */
  sampleSpeaking?: () => boolean;
  /** The Audio2Face frame for this instant (ADR-112), or null. Read-only. */
  sampleFace?: () => Shape | null;
  /** Seconds until the next scheduled onset, or null. Feeds anticipation. */
  sampleOnset?: () => number | null;
  /** The learner's side of the turn — typing, recording, just sent. */
  sampleCues?: () => TutorCues;
  /** The tone's emotion, from lesson state (doc 32 §4). Eased on this side. */
  emotion?: { category: EmotionCategory; intensity: number } | null;
  /** Session phase where there is no sound to derive it from. */
  phase?: 'thinking' | 'listening';
  reducedMotion?: boolean;
  /** Called once, on any failure that means there will be no frame. */
  onUnavailable?: (reason: string) => void;
  /** Called on the FIRST rendered frame — `tutor-stage.ts`'s promotion cue. */
  onFirstFrame?: () => void;
  /** Overrides the served asset with another `.gltf` URL. */
  modelUri?: string;
}

/**
 * Rebuilds every skinned material as a plain `MeshStandardMaterial`, exactly as
 * `simplifyMaterialsForDawn` does on native — and for the same reason, which is
 * NOT the reason that file predicted.
 *
 * The native comment says this asset "keeps working on the web scene, which
 * drives WebGL and has no such problem". Measured in Chrome 141 on WebGPU, it
 * does not: three's node graph for the body's authored
 * `KHR_materials_specular`/`anisotropy`/`ior` emits a vertex attribute the
 * browser rejects outright —
 *
 *   Failed to read 'format' property from 'GPUVertexAttribute':
 *   provided value 'unorm32x4' not valid enum value of type GPUVertexFormat
 *
 * — thrown from `createRenderPipeline` on the first `render()`, i.e. as a
 * demote-to-2D with no visible cause. So the extension strip is a WebGPU rule
 * rather than a Dawn one, and the web scene that "had no problem" was the
 * WebGL2 one from doc 22 §4.
 *
 * THE CEILING, same as native: specular tint, anisotropic hair sheen and IOR
 * are gone. The fix is not to put the extensions back — it is
 * `@acme/avatar/body`'s own TSL hair and skin materials (doc 22 §4 rows 1-5).
 */
function simplifySkinnedMaterials(scene: THREE.Object3D): void {
  scene.traverse((child) => {
    const mesh = child as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    const authored = mesh.material as THREE.MeshPhysicalMaterial;
    mesh.material = new THREE.MeshStandardMaterial({
      map: authored.map ?? null,
      normalMap: authored.normalMap ?? null,
      roughnessMap: authored.roughnessMap ?? null,
      roughness: authored.roughness,
      metalness: 0,
      alphaTest: authored.alphaTest,
      side: authored.side,
    });
    authored.dispose();
  });
}

export function TutorAvatar3D({
  active,
  isSpeaking,
  sampleMouth,
  sampleSpeaking,
  sampleFace,
  sampleOnset,
  sampleCues,
  emotion,
  phase,
  reducedMotion = false,
  onUnavailable,
  onFirstFrame,
  modelUri,
}: TutorAvatar3DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  /*
    Every per-frame input goes through a ref, and that is not laziness about
    dependencies — it is the point. The loop below is built ONCE for the life of
    the mount; if `isSpeaking` were a dependency, every turn of the conversation
    would tear down the renderer and reload the body mid-sentence.
  */
  const speakingRef = useRef(isSpeaking);
  const reducedMotionRef = useRef(reducedMotion);
  const sampleMouthRef = useRef(sampleMouth);
  const sampleSpeakingRef = useRef(sampleSpeaking);
  const sampleFaceRef = useRef(sampleFace);
  const sampleOnsetRef = useRef(sampleOnset);
  const sampleCuesRef = useRef(sampleCues);
  /*
    The emotion is EASED here, on the frame loop, by the same `EmotionState`
    the 2D face bus uses (0.4 s smoothstep — an instant baseline change reads
    as a glitch on a face). The prop only sets the target.
  */
  const emotionStateRef = useRef(new EmotionState());
  const phaseRef = useRef(phase);
  const activeRef = useRef(active);
  const onFirstFrameRef = useRef(onFirstFrame);
  const onUnavailableRef = useRef(onUnavailable);

  /*
    Written in an effect rather than during render — a ref write in a render
    body is not safe under concurrent rendering. One effect with no dependency
    array: it runs after every commit, which is exactly "the loop sees what the
    last committed render said", and it schedules nothing.
  */
  useEffect(() => {
    speakingRef.current = isSpeaking;
    reducedMotionRef.current = reducedMotion;
    sampleMouthRef.current = sampleMouth;
    sampleSpeakingRef.current = sampleSpeaking;
    sampleFaceRef.current = sampleFace;
    sampleOnsetRef.current = sampleOnset;
    sampleCuesRef.current = sampleCues;
    phaseRef.current = phase;
    activeRef.current = active;
    onFirstFrameRef.current = onFirstFrame;
    onUnavailableRef.current = onUnavailable;
  });

  const presenceRef = useRef<HumanoPresence | null>(null);

  useEffect(() => {
    if (emotion) emotionStateRef.current.set(emotion.category, emotion.intensity);
    else emotionStateRef.current.set('neutral');
  }, [emotion?.category, emotion?.intensity]);

  useEffect(() => {
    let disposed = false;
    let renderer: THREE.WebGPURenderer | null = null;
    let observer: ResizeObserver | null = null;

    const fail = (reason: string) => {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[natalie-stage] unavailable:', reason);
      }
      if (!disposed) onUnavailableRef.current?.(reason);
    };

    void (async () => {
      const canvas = canvasRef.current;
      const wrapper = wrapperRef.current;
      if (!canvas || !wrapper) return fail('canvas ref was empty after mount');

      const mountedAt = Date.now();
      let body: THREE.Group;
      try {
        body = await preloadNatalie(modelUri);
      } catch (error) {
        return fail(`glTF load failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      if (disposed) return;

      const scene = new THREE.Scene();
      addRig(scene);
      simplifySkinnedMaterials(body);
      scene.add(body);

      const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 10);

      /*
        SHE IS NEVER STRETCHED AND NEVER CHANGES SIZE.

        Size is `frameBody`'s half — it ignores aspect. Squish is this half: the
        drawing buffer does not follow the CSS box, so a pane opening beside her
        would otherwise scale a stale frame into the new width and leave her fat
        for good. Measured from the WRAPPER rather than the canvas, because the
        canvas is what this function resizes — reading it back is a loop.
      */
      let framedWidth = 0;
      let framedHeight = 0;
      const refit = () => {
        const scale = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
        const width = Math.round(wrapper.clientWidth * scale);
        const height = Math.round(wrapper.clientHeight * scale);
        if (width === framedWidth && height === framedHeight) return;
        if (width === 0 || height === 0) return;
        framedWidth = width;
        framedHeight = height;
        // `false`: the canvas sizes itself in CSS (100%/100%), so three must
        // not write `domElement.style` and pin it to a pixel size.
        renderer?.setSize(width, height, false);
        camera.aspect = width / height;
        frameBody(camera, body);
      };

      const presence = createHumanoPresence(body);
      presenceRef.current = presence;

      /*
        WebGPU where it exists, WebGL2 where it does not. Safari and Firefox
        reach this line, and a monogram is not the right answer to a browser
        choice a child did not make.
      */
      const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
      renderer = new THREE.WebGPURenderer({
        canvas,
        antialias: true,
        alpha: true,
        forceWebGL: !hasWebGPU,
      });
      // A transparent clear, so the stage's own ground shows behind her
      // instead of the renderer's black.
      renderer.setClearColor(0x000000, 0);
      try {
        // Awaited. Fire-and-forget lets the first render race device creation.
        await renderer.init();
      } catch (error) {
        return fail(`renderer.init() failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      if (disposed) return;

      observer = new ResizeObserver(() => refit());
      observer.observe(wrapper);
      refit();

      let lastMs = 0;
      let announced = false;

      renderer.setAnimationLoop((timeMs: number) => {
        const delta = lastMs === 0 ? 1 / 60 : (timeMs - lastMs) / 1000;
        lastMs = timeMs;

        /*
          The gate. Not `setAnimationLoop(null)` on the inactive edge: skipping
          the work is the cheap, reversible form of the same thing, and it keeps
          the native and web stages behaving identically on a pane toggle.
        */
        if (!activeRef.current) return;

        const speaking = sampleSpeakingRef.current?.() ?? speakingRef.current;
        const mouth = speaking ? (sampleMouthRef.current?.(timeMs) ?? 0) : 0;
        const face = speaking ? (sampleFaceRef.current?.() ?? null) : null;
        const cues = sampleCuesRef.current?.();
        const onset = sampleOnsetRef.current?.() ?? null;
        /*
          Listening is half of human. The learner typing or talking is
          `listening` whatever the store says, and their send is the pause event
          the torso turns on. Speech still wins: sound coming out is the phase.
        */
        const nextPhase = speaking
          ? 'speaking'
          : cues?.partnerSpeaking
            ? 'listening'
            : (phaseRef.current ?? 'waiting');
        presence.step(delta, {
          speaking,
          phase: nextPhase,
          mouth,
          face,
          emotion: emotionStateRef.current.step(delta),
          partnerPauseEvent: cues?.partnerPauseEvent ?? false,
          timeUntilOnset: onset ?? undefined,
          reducedMotion: reducedMotionRef.current,
          cameraPosition: camera.position,
        });

        /*
          A THROWING FRAME STOPS THE LOOP. A lost device or a shader the backend
          refuses surfaces here EVERY frame; without this the tab burns 60
          identical errors a second behind an empty box. One report, loop off,
          demote to 2D.
        */
        try {
          renderer?.render(scene, camera);
        } catch (error) {
          renderer?.setAnimationLoop(null);
          fail(`render failed: ${error instanceof Error ? error.message : String(error)}`);
          return;
        }

        if (!announced) {
          announced = true;
          if (process.env.NODE_ENV !== 'production') {
            console.log(
              `[natalie-stage] first frame ${Date.now() - mountedAt}ms after mount (${hasWebGPU ? 'webgpu' : 'webgl2'})`
            );
          }
          onFirstFrameRef.current?.();
        }
      });
    })();

    return () => {
      // GENUINE UNMOUNT ONLY — a pane toggle flips `active`.
      disposed = true;
      presenceRef.current = null;
      observer?.disconnect();
      if (!renderer) return;
      renderer.setAnimationLoop(null);
      renderer.dispose();
    };
    // Built once per mount. `modelUri` is the one input that changes WHICH body
    // is on the stage, so it is the only legitimate reason to rebuild.
  }, [modelUri]);

  /*
    Rest her when the loop stops, so the last painted frame is a calm one rather
    than whatever half-open mouth the freeze happened to catch.
  */
  useEffect(() => {
    if (!active) presenceRef.current?.rest();
  }, [active]);

  return (
    <div ref={wrapperRef} style={{ flex: 1, minHeight: 0, position: 'relative' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
}

export default TutorAvatar3D;
