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
import { Canvas, type CanvasRef, type NativeCanvas, type RNCanvasContext } from 'react-native-webgpu';
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createHumanoPresence, frameBody, type HumanoPresence } from '@acme/avatar/body';

/*
  ONE MISSING DOM GLOBAL, AND IT IS NOT OPTIONAL.

  three's `FileLoader` wraps every fetch whose body is a `ReadableStream` in a
  progress-reporting stream, and constructs `new ProgressEvent('progress', …)`
  on EVERY chunk — unguarded, whether or not anyone passed an `onProgress`.
  Hermes has no `ProgressEvent`, so the read loop throws on the first chunk,
  the stream yields a non-ArrayBuffer, and `GLTFLoader` reports it as
  `JSON Parse error: Unexpected character: o` — the 'o' of "[object …]".
  Measured on the Duo; it is the first thing this stage hit on real hardware.

  three only ever uses the object as a data carrier, so a plain class with the
  four fields is a complete substitute. Installed at module scope, which this
  module already owns: it is lazy-imported behind the flag, so nothing on the
  2D path gains a global it did not have.
*/
if (typeof (globalThis as { ProgressEvent?: unknown }).ProgressEvent === 'undefined') {
  (globalThis as { ProgressEvent?: unknown }).ProgressEvent = class {
    readonly type: string;
    readonly lengthComputable: boolean;
    readonly loaded: number;
    readonly total: number;
    constructor(
      type: string,
      init: { lengthComputable?: boolean; loaded?: number; total?: number } = {}
    ) {
      this.type = type;
      this.lengthComputable = init.lengthComputable ?? false;
      this.loaded = init.loaded ?? 0;
      this.total = init.total ?? 0;
    }
  };
}

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

/** The lens. The DISTANCE is fitted — see `frameBody` in `@acme/avatar/body`. */
const CAMERA_FOV = 38;

export interface TutorAvatar3DProps {
  /**
   * False whenever she is not on screen — collapsed, a hidden pane, a
   * backgrounded app. The renderer stays alive; the loop does not run.
   */
  active: boolean;
  isSpeaking: boolean;
  /** Mouth openness 0..1 at an audio-clock instant. Read-only by contract. */
  sampleMouth?: (nowMs: number) => number;
  /** Whether sound is coming out THIS FRAME. Preferred over `isSpeaking`. */
  sampleSpeaking?: () => boolean;
  /** Session phase where there is no sound to derive it from. */
  phase?: 'thinking' | 'listening';
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

/**
 * Fetches the glTF and its `.bin` ourselves and hands them to three through its
 * own cache, because three's `FileLoader` cannot fetch on React Native.
 *
 * THE BUG, measured on the Duo rather than reasoned about. `FileLoader` wraps
 * any response whose `body` is a `ReadableStream` in a progress-reporting
 * stream and re-wraps that in `new Response(stream, …)`. React Native's
 * `Response` is the whatwg-fetch polyfill, which has no stream body support:
 * it stringifies whatever it is given, so `.arrayBuffer()` comes back as the 23
 * bytes of `"[object ReadableStream]"` and `GLTFLoader` reports
 * `JSON Parse error: Unexpected character: o`. Plain `fetch(...).arrayBuffer()`
 * on the same URL returns all 218,678 bytes — the transport is fine, only
 * three's wrapper is not.
 *
 * `Cache.get('file:' + url)` is checked before any request is made, so seeding
 * it is the whole fix: no patched dependency, no deleted global, and the code
 * that runs is three's. Textures need no help — `createImageBitmap` exists here
 * (react-native-webgpu installs it), so `GLTFLoader` routes images through
 * `ImageBitmapLoader`, which uses plain `fetch` + `blob()` and never wraps.
 *
 * Only the `.bin` is seeded alongside the glTF: it is the one other file that
 * goes through `FileLoader`. Its URL is composed exactly the way `GLTFLoader`
 * composes it, so the two keys cannot drift.
 */
async function primeLoaderCache(gltfUrl: string): Promise<void> {
  THREE.Cache.enabled = true;

  const fetchBuffer = async (url: string): Promise<ArrayBuffer> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status} for ${url}`);
    return response.arrayBuffer();
  };

  const gltfBytes = await fetchBuffer(gltfUrl);
  THREE.Cache.add(`file:${gltfUrl}`, gltfBytes);

  const base = THREE.LoaderUtils.extractUrlBase(gltfUrl);
  const json = JSON.parse(new TextDecoder().decode(gltfBytes)) as {
    buffers?: { uri?: string }[];
  };
  for (const buffer of json.buffers ?? []) {
    if (!buffer.uri || buffer.uri.startsWith('data:')) continue;
    const url = THREE.LoaderUtils.resolveURL(buffer.uri, base);
    THREE.Cache.add(`file:${url}`, await fetchBuffer(url));
  }
}

/**
 * Rebuilds every skinned material as a plain `MeshStandardMaterial`, keeping
 * the authored colour, normal and roughness maps and dropping everything else.
 *
 * WHY, measured on the Duo rather than assumed. This body is authored with
 * `KHR_materials_specular`, `KHR_materials_anisotropy` and `KHR_materials_ior`,
 * so `GLTFLoader` builds a `MeshPhysicalMaterial` — and three's WebGPU node
 * graph for that material makes Dawn throw on the first
 * `renderer.render(...)`: `Exception in HostFunction: <unknown>`, every frame,
 * with a black surface behind it. The bisect that found it is worth keeping:
 * `MeshNormalMaterial` rendered her perfectly (so geometry, skin and framing
 * were never the problem), colour-map-only rendered her in skin, and colour +
 * normal + roughness renders her as she is meant to look. Only the extension
 * path fails.
 *
 * This is ADR-111's "strip that extension only" rule, applied at load rather
 * than by re-exporting the body — the same asset then keeps working on the web
 * scene, which drives WebGL and has no such problem.
 *
 * THE CEILING, stated so it is not rediscovered as a surprise: specular tint,
 * anisotropic hair sheen and IOR are gone, so the hair reads flatter here than
 * it does on the web. The fix is not to put the extensions back — it is
 * `@acme/avatar/body`'s own hair and skin materials (doc 22 §4 rows 1-5), which
 * are written in TSL for exactly this renderer and are the next piece of work.
 */
function simplifyMaterialsForDawn(scene: THREE.Object3D): void {
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
      // The body is authored alphaMode MASK — the hair cards depend on it.
      alphaTest: authored.alphaTest,
      // Authored doubleSided. `FrontSide` was tried on the Duo for the
      // shirt/arm silhouette and changed nothing — that is the bind pose, not
      // the winding (see STANCE in presence/humano.ts).
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
  phase,
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
  const sampleSpeakingRef = useRef(sampleSpeaking);
  const phaseRef = useRef(phase);
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
    sampleSpeakingRef.current = sampleSpeaking;
    phaseRef.current = phase;
    activeRef.current = active;
    onFirstFrameRef.current = onFirstFrame;
    onUnavailableRef.current = onUnavailable;
  });

  const presenceRef = useRef<HumanoPresence | null>(null);

  // A ref, not state: a pane animating open fires `onLayout` every frame, and
  // this component owns a renderer built once per mount.
  const layoutRef = useRef({ width: 0, height: 0 });

  useEffect(() => {
    let disposed = false;
    let renderer: THREE.WebGPURenderer | null = null;
    /*
      The cleanup's handle on the canvas context — see the teardown below. It
      is a second name for what the async body calls `context` because that one
      is a `const` inside a closure the cleanup cannot reach, and the teardown
      needs it after everything that body owns has gone.
    */
    let surfaceContext: RNCanvasContext | null = null;

    const fail = (reason: string) => {
      if (!disposed) onUnavailableRef.current?.(reason);
    };

    (async () => {
      const canvas = canvasRef.current;
      if (!canvas) return fail('canvas ref was empty after mount');
      const context = canvas.getContext('webgpu');
      if (!context) return fail('getContext("webgpu") returned null');
      surfaceContext = context;

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
        await primeLoaderCache(uri);
        gltf = await new Promise((resolve, reject) => {
          new GLTFLoader().load(
            uri,
            (loaded) => resolve(loaded as unknown as { scene: THREE.Group }),
            undefined,
            (error) => reject(error instanceof Error ? error : new Error(String(error)))
          );
        });
      } catch (error) {
        return fail(
          `glTF load failed: ${error instanceof Error ? error.message : String(error)} [${uri}]`
        );
      }
      if (disposed) return;

      const scene = new THREE.Scene();
      addRig(scene);
      scene.add(gltf.scene);

      const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 10);

      /*
        SHE IS NEVER STRETCHED AND NEVER CHANGES SIZE.

        Size is `frameBody`'s half — it ignores aspect. Squish is this half: the
        drawing buffer does not follow the view (`SurfaceInfo::resize`: "does
        not resize the drawing buffer: that tracks canvas.width/height"), so
        without this the compositor scales a stale texture into the new pane
        width and she stays fat, or thin, for good.

        From `onLayout`, not `canvas.clientWidth`. `getCurrentTexture` does
        refresh clientWidth from the surface, but on the Duo it never moved
        through a pane toggle and she stayed squashed.
      */
      let framedWidth = 0;
      let framedHeight = 0;
      const scale = PixelRatio.get();
      const refit = () => {
        const layout = layoutRef.current;
        const width = Math.round(layout.width * scale);
        const height = Math.round(layout.height * scale);
        if (width === framedWidth && height === framedHeight) return;
        if (width === 0 || height === 0) return;
        framedWidth = width;
        framedHeight = height;
        // Writes canvas.width/height, which is what getCurrentTexture
        // reconfigures on. `false`: three would otherwise write
        // `domElement.style`, which this canvas has not got.
        renderer?.setSize(width, height, false);
        camera.aspect = width / height;
        frameBody(camera, gltf.scene);
      };

      simplifyMaterialsForDawn(gltf.scene);

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

        refit();

        const speaking = sampleSpeakingRef.current?.() ?? speakingRef.current;
        const mouth = speaking ? (sampleMouthRef.current?.(timeMs) ?? 0) : 0;
        presence.step(delta, {
          speaking,
          // Speech wins: sound coming out is the phase, whatever the session
          // last said. Otherwise the session's own word, else waiting.
          phase: speaking ? 'speaking' : (phaseRef.current ?? 'waiting'),
          mouth,
          reducedMotion: reducedMotionRef.current,
          cameraPosition: camera.position,
        });

        /*
          A THROWING FRAME STOPS THE LOOP.

          Anything Dawn refuses — a shader it will not compile, a destroyed
          device, a surface that went away — surfaces here as an exception, and
          it surfaces EVERY frame. Without this the app burns 60 identical
          errors a second behind a black view, which is both a battery fire and
          a log nobody can read. One report, loop off, demote to 2D.
        */
        try {
          renderer?.render(scene, camera);
          // Three draws into the surface; the surface is not shown until it is
          // presented. Omitting this is a black view behind a healthy loop.
          context.present();
        } catch (error) {
          renderer?.setAnimationLoop(null);
          fail(`render failed: ${error instanceof Error ? error.message : String(error)}`);
          return;
        }

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
      /*
        UNCONFIGURE BEFORE DISPOSE, OR ANDROID KILLS THE PROCESS.

        `renderer.dispose()` destroys the Dawn device. The native TextureView
        is dropped by Fabric a frame or two LATER, and its detach releases the
        `wgpu::Surface` — whose swapchain still points at the device that is
        now gone. Dawn walks it anyway: `~Surface` → `DetachFromSurface` →
        `FencedDeleter::DeleteWhenUnused` → `pthread_mutex_lock(nullptr+0x20)`
        → SIGSEGV, with no JS frame anywhere in the tombstone.

        `unconfigure()` detaches that swapchain while the device is still
        alive, so the later release has nothing left to walk. It is the whole
        fix, and it has to be here rather than in the async body: the surface
        outlives everything that body owns.
      */
      surfaceContext?.unconfigure();
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
    <View
      style={{ flex: 1 }}
      onLayout={(event) => {
        layoutRef.current = event.nativeEvent.layout;
      }}>
      <Canvas ref={canvasRef} style={{ flex: 1 }} transparent />
    </View>
  );
}

export default TutorAvatar3D;
