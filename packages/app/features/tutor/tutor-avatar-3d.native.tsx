/**
 * Natalie, rendered — the native WebGPU stage behind ADR-111's flag.
 *
 * This is the third step of the smoke ladder in `apps/mobile/src/native-3d/
 * webgpu-smoke.tsx`, promoted from a rotating cube to the real body: same Dawn
 * surface, same `WebGPURenderer`, same three rules (await `init()`, `present()`
 * every frame, dispose only on a genuine unmount). What is new here is the
 * body, the framing, and the loop's OWN visibility gate.
 *
 * FIVE THINGS THIS FILE IS BUILT AROUND, each of them a bug if reversed:
 *
 *  1. `react-native-webgpu` installs its JSI bindings and assigns
 *     `navigator.gpu` AS A SIDE EFFECT OF IMPORT. So this module is only ever
 *     reached through `React.lazy` from `tutor-avatar.tsx`, behind the flag. A
 *     learner on the 2D path must never pay for it, and on a binary that
 *     predates the native module it would throw at boot.
 *  2. THE LOOP STOPS ITSELF. `react-freeze` suspends re-renders, not effects —
 *     measured on this repo, a frozen face bus went on sampling ~130x/s. A
 *     frozen 3D pane would go on rendering at 60fps into a surface nobody can
 *     see. `active` is that switch, and it is the battery fix.
 *  3. IT NEVER UNMOUNTS ON A PANE TOGGLE. ADR-111's mount-site rule: hiding her
 *     freezes, it does not tear down. Disposal here is genuine unmount only —
 *     leaving the session — because rebuilding the renderer and re-parsing a
 *     14 MB glTF on a fold is exactly the stutter the rule exists to prevent.
 *  4. THE MOUTH IS AN INPUT, NOT A FETCH. `sampleMouth` is called with the
 *     audio clock's now; the audio queue stays where it is, outside React, and
 *     this stage only ever READS it. Nothing here can affect her voice.
 *  5. A FAILURE IS 2D, NOT AN ERROR. Every path that cannot produce a frame
 *     calls `onUnavailable` and renders nothing, so `tutor-stage.ts` demotes to
 *     the 2D mark. A child is never shown a renderer's bad day.
 *
 * SOT: docs/decisions/adr-111-native-3d-runtime.md · packages/avatar/src/presence/humano.ts
 *      apps/mobile/src/native-3d/webgpu-smoke.tsx · qa/walkthroughs/NATIVE-3D-SMOKE-2026-09-03.md
 * SOT-KEYWORDS: natalie native 3d webgpu three stage gltf presence flag dispose freeze mobile
 */
import { useEffect, useRef } from 'react';
import { Image, PixelRatio, View } from 'react-native';
import { Canvas, type CanvasRef, type NativeCanvas } from 'react-native-webgpu';
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createHumanoPresence, type HumanoPresence } from '@acme/avatar/body';

/*
  THE ASSET IS A SPLIT `.gltf`, AND IT HAS TO BE.

  Hermes has no `new Blob([ArrayBuffer])`, which is how `GLTFLoader` hands an
  embedded texture to the decoder — so a `.glb` with images in its buffer views
  loads everywhere except a device. `packages/avatar/src/assets.ts` encodes that
  as the ".glb rule" and `react-native-webgpu`'s own Retargeting example hits the
  same wall. `natalie-phone/` is `humano-marketing-source.glb` resized to 1024,
  deduped, pruned and copied out to `.gltf` + `.bin` + eight external images.

  `require` + `Image.resolveAssetSource` is the DEV path. A release build
  flattens assets and rewrites relative paths, so the sibling `.bin` can no
  longer be found from the `.gltf`; the demo path is `assets.ts`'s manifest and
  downloader against a downloaded directory (ADR-111 §The asset). Passing
  `modelUri` takes this file down that path with no edit.
*/
// Metro asset requires must be static `require` calls — an `import` of a
// non-code asset resolves to nothing the packager can register.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const BUNDLED_MODEL = require('@acme/avatar/assets/natalie-phone/natalie.gltf');

/** Framing, carried over from the web scene so the two Natalies are one person. */
const CAMERA_FOV = 38;
const CAMERA_POSITION: readonly [number, number, number] = [0, 1.45, 1.15];
const LOOK_AT = new THREE.Vector3(0, 1.5, 0);

export interface TutorAvatar3DProps {
  /**
   * False whenever she is not on screen — collapsed, a hidden pane, a
   * backgrounded app. The renderer stays alive; the loop does not run.
   */
  active: boolean;
  isSpeaking: boolean;
  /** Mouth openness 0..1 at an audio-clock instant. Read-only by contract. */
  sampleMouth?: (nowMs: number) => number;
  reducedMotion?: boolean;
  /** Called once, on any failure that means there will be no frame. */
  onUnavailable?: (reason: string) => void;
  /** Called on the FIRST presented frame — `tutor-stage.ts`'s promotion cue. */
  onFirstFrame?: () => void;
  /** Overrides the bundled dev asset with a downloaded `.gltf` URI. */
  modelUri?: string;
}

/**
 * Drops the listeners three leaves on its module-level `QuadMesh` geometry
 * after a renderer is disposed (wcandillon/react-native-webgpu#445) — without
 * this the disposed backend stays reachable for the process lifetime. Safe
 * because the app has at most one live WebGPU renderer at a time.
 */
type ListenerHolder =
  | THREE.BufferGeometry
  | THREE.BufferAttribute
  | THREE.InterleavedBufferAttribute;

function clearStaleListeners(target: ListenerHolder | null | undefined): void {
  if (!target) return;
  const holder = target as { _listeners?: object };
  if (holder._listeners) holder._listeners = {};
}

/**
 * The rig the web scene proves on this body: warm key, cool fill, a low warm
 * bounce so the jaw underside stays alive, and ambient that never becomes the
 * key. Deliberately NOT `createStage()` from `@acme/avatar/body` yet — that rig
 * is RectAreaLight + GTAO + bloom on `RenderPipeline`, verified so far only in
 * headless Chromium on WebGL2 (doc 22 §4 rows 8-12). Moving to it is a look
 * change with its own golden capture, not a thing to fold into first light.
 */
function addRig(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight(0xfff8f2, 0x4a3b36, 1.0));
  scene.add(new THREE.AmbientLight(0xfff6ed, 0.6));
  const key = new THREE.DirectionalLight(0xfff0e0, 1.2);
  key.position.set(1.2, 2.5, 1.8);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xe0f0ff, 0.5);
  fill.position.set(-1.2, 1.2, 1.5);
  scene.add(fill);
  const bounce = new THREE.DirectionalLight(0xffe8d6, 0.4);
  bounce.position.set(0, -1.0, 1.0);
  scene.add(bounce);
}

export function TutorAvatar3D({
  active,
  isSpeaking,
  sampleMouth,
  reducedMotion = false,
  onUnavailable,
  onFirstFrame,
  modelUri,
}: TutorAvatar3DProps) {
  const canvasRef = useRef<CanvasRef>(null);

  /*
    Every per-frame input goes through a ref, and that is not laziness about
    dependencies — it is the point. The loop below is built ONCE for the life of
    the mount; if `isSpeaking` were a dependency, every turn of the conversation
    would tear down the renderer and reload the body mid-sentence.
  */
  const speakingRef = useRef(isSpeaking);
  const reducedMotionRef = useRef(reducedMotion);
  const sampleMouthRef = useRef(sampleMouth);
  const activeRef = useRef(active);
  const onFirstFrameRef = useRef(onFirstFrame);
  const onUnavailableRef = useRef(onUnavailable);

  /*
    Written in an effect rather than during render — a ref write in a render
    body is not safe under concurrent rendering (a render that is thrown away
    would still have moved the loop's inputs). One effect with no dependency
    array: it runs after every commit, which is exactly "the loop sees what the
    last committed render said", and it schedules nothing.
  */
  useEffect(() => {
    speakingRef.current = isSpeaking;
    reducedMotionRef.current = reducedMotion;
    sampleMouthRef.current = sampleMouth;
    activeRef.current = active;
    onFirstFrameRef.current = onFirstFrame;
    onUnavailableRef.current = onUnavailable;
  });

  const presenceRef = useRef<HumanoPresence | null>(null);

  useEffect(() => {
    let disposed = false;
    let renderer: THREE.WebGPURenderer | null = null;

    const fail = (reason: string) => {
      if (!disposed) onUnavailableRef.current?.(reason);
    };

    (async () => {
      const canvas = canvasRef.current;
      if (!canvas) return fail('canvas ref was empty after mount');
      const context = canvas.getContext('webgpu');
      if (!context) return fail('getContext("webgpu") returned null');

      // The surface comes up at layout size; the drawing buffer has to be
      // scaled to physical pixels or she renders soft on every modern phone.
      const surface: NativeCanvas = canvas.getNativeSurface();
      surface.width = surface.clientWidth * PixelRatio.get();
      surface.height = surface.clientHeight * PixelRatio.get();

      // `resolveAssetSource` returns null for an asset the packager did not
      // register — a real state on a stale binary, so it is a demote-to-2D
      // rather than a crash.
      const uri = modelUri ?? Image.resolveAssetSource(BUNDLED_MODEL)?.uri;
      if (!uri) return fail('the bundled natalie-phone glTF did not resolve');
      let gltf: { scene: THREE.Group };
      try {
        gltf = await new GLTFLoader().loadAsync(uri);
      } catch (error) {
        return fail(`glTF load failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      if (disposed) return;

      const scene = new THREE.Scene();
      addRig(scene);
      scene.add(gltf.scene);

      const { width, height } = context.canvas;
      const camera = new THREE.PerspectiveCamera(CAMERA_FOV, width / height, 0.1, 10);
      camera.position.set(...CAMERA_POSITION);
      camera.lookAt(LOOK_AT);

      const presence = createHumanoPresence(gltf.scene);
      presenceRef.current = presence;

      renderer = new THREE.WebGPURenderer({ antialias: true, canvas: context.canvas, context });
      try {
        // Awaited. Fire-and-forget lets the first render race device creation,
        // and on a cold pipeline cache that race is lost often enough to look
        // like "WebGPU doesn't work on this phone".
        await renderer.init();
      } catch (error) {
        return fail(`renderer.init() failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      if (disposed) return;

      let lastMs = 0;
      let announced = false;

      renderer.setAnimationLoop((timeMs: number) => {
        const delta = lastMs === 0 ? 1 / 60 : (timeMs - lastMs) / 1000;
        lastMs = timeMs;

        /*
          The gate. Not `setAnimationLoop(null)` on the inactive edge: three's
          loop is also what keeps the surface's swapchain warm, and stopping and
          restarting it per pane toggle is where #445's unrecoverable state
          lives. Skipping the work is the cheap, reversible form of the same
          thing — no draw, no present, no morph write.
        */
        if (!activeRef.current) return;

        const speaking = speakingRef.current;
        const mouth = speaking ? (sampleMouthRef.current?.(timeMs) ?? 0) : 0;
        presence.step(delta, {
          speaking,
          mouth,
          reducedMotion: reducedMotionRef.current,
          cameraPosition: camera.position,
        });

        renderer?.render(scene, camera);
        // Three draws into the surface; the surface is not shown until it is
        // presented. Omitting this is a black view behind a healthy loop.
        context.present();

        if (!announced) {
          announced = true;
          onFirstFrameRef.current?.();
        }
      });
    })();

    return () => {
      // GENUINE UNMOUNT ONLY — see the header. A pane toggle flips `active`.
      disposed = true;
      presenceRef.current = null;
      if (!renderer) return;
      renderer.setAnimationLoop(null);
      renderer.dispose();
      const quad = new THREE.QuadMesh();
      clearStaleListeners(quad.geometry);
      clearStaleListeners(quad.geometry.index);
      for (const attribute of Object.values(quad.geometry.attributes)) {
        clearStaleListeners(attribute);
      }
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
    <View style={{ flex: 1 }}>
      <Canvas ref={canvasRef} style={{ flex: 1 }} transparent />
    </View>
  );
}

export default TutorAvatar3D;
