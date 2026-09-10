/**
 * The shader probe — the first thing in this port that actually renders.
 *
 * WHAT THIS IS FOR. Every material in `packages/avatar` is verified at the
 * level of "the symbols exist and the node graph constructs in Node". That is
 * necessary and it is not sufficient: a TSL graph can construct perfectly and
 * still fail to COMPILE — a bad swizzle, a type the builder cannot resolve, a
 * lighting-model override whose shape three does not accept. Those failures
 * only appear when a renderer walks the graph and emits shader source.
 *
 * This entry point makes a renderer do exactly that, for every material, and
 * reports what broke. It is the cheapest possible answer to "does any of this
 * actually work", and until it runs the honest status of the whole port is
 * "compiles as TypeScript".
 *
 * ── TWO BACKENDS, AND WHAT EACH ONE PROVES ──────────────────────────────────
 *
 * `WebGPURenderer` has two backends and this probe drives both, selected by
 * `window.__PROBE_BACKEND` (`run.mjs --backend webgl|webgpu`, default `webgl`).
 *
 *   `webgl` — `forceWebGL: true`, GLSL out, runs over SwiftShader in any
 *   Chromium. This is the portable gate and it must keep working: a malformed
 *   node graph fails on both backends, and that is the failure mode this port
 *   is most exposed to (rows 1, 3 and 11 are all "built, look unverified").
 *   What it does NOT prove is WGSL compilation, the compute path (WebGL2 has
 *   no compute, so §4 row 14 stays unverified there), or the LOOK.
 *
 *   `webgpu` — the real Dawn backend, WGSL out. Needs a Chrome with WebGPU
 *   compiled in (Playwright's bundled Chromium does not have it; pass
 *   `CHROME_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`).
 *   This is the backend that `tutor-avatar-3d.web.tsx` demotes away from, so it
 *   is the only one that can answer whether a material's authored extension
 *   graph — `anisotropy` on the hair, in particular — survives
 *   `createRenderPipeline`.
 *
 * Neither is the golden gate. SwiftShader is a software rasteriser and the
 * WebGPU frames come off whatever GPU the host happens to have; no output of
 * this file may be checked in as a golden.
 *
 * PIPELINE ERRORS DO NOT ALWAYS THROW. On the WebGPU backend three swallows
 * some failures into `console.error`, and Dawn reports others through the
 * device's uncaptured-error event. Every case therefore records `consoleErrors`
 * and `deviceErrors` alongside the thrown `error`, and `compiled` is false if
 * any of the three fired.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §4, §10.5
 * SOT-KEYWORDS: shader probe compile tsl webgl2 webgpu wgsl swiftshader dawn headless verification materials
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  RectAreaLight,
  Scene,
  SphereGeometry,
} from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { SkinNodeMaterial } from '../../src/materials/skin.ts';
import { initRectAreaLights } from '../../src/stage.ts';
import { EYE_AUX_ATTRIBUTE, makeEyeMaterials } from '../../src/materials/eyes.ts';
import { HAIR_PHASE_ATTRIBUTE, HAIR_T_ATTRIBUTE, createHairMaterial } from '../../src/materials/hair.ts';
import { GARMENT_REST_ATTRIBUTE, createDenimMaterial } from '../../src/materials/denim.ts';
import { CAVITY_ATTRIBUTE, makeMouthMaterials } from '../../src/materials/mouth.ts';
import { BROW_TIP_ATTRIBUTE, createBrowMaterial } from '../../src/materials/brow.ts';
import { SKIN_CURVATURE_ATTRIBUTE, SKIN_THICKNESS_ATTRIBUTE } from '../../src/materials/skin.ts';

export interface ProbeResult {
  id: string;
  compiled: boolean;
  error: string | null;
  /** `console.error` text emitted while THIS case rendered. See the header. */
  consoleErrors: string[];
  /** Dawn's uncaptured validation/internal errors for this case. WebGPU only. */
  deviceErrors: string[];
  /** Mean luminance of the rendered patch, 0-255. Catches an all-black draw. */
  meanLuma: number;
  /** Distinct 8-bit luminance values. 1 means a flat fill — i.e. nothing shaded. */
  distinctLuma: number;
  /** The rendered patch as a data URL, so a person can look at it. */
  png: string | null;
  /**
   * `webgpu` or `webgl2`, read off the backend three actually built — NOT off
   * the flag that asked for it. `WebGPURenderer` falls back to WebGL when the
   * adapter request fails, and a WebGPU run that quietly became a WebGL run
   * would report ten green cases having proven nothing new.
   */
  backendId: string;
  /** `wgsl` or `glsl`, sniffed from the emitted source. The same guard again. */
  shaderLanguage: string;
  /** The emitted fragment source. `run.mjs` writes it next to the images. */
  fragmentShader: string | null;
}

/** Which backend this run drives. Set by `run.mjs`; `webgl` when absent. */
function selectedBackend(): 'webgl' | 'webgpu' {
  return (window as unknown as { __PROBE_BACKEND?: string }).__PROBE_BACKEND === 'webgpu'
    ? 'webgpu'
    : 'webgl';
}

/** Fills the per-vertex attributes each material reads. Values are plausible, not baked. */
function withAttributes(geometry: BufferGeometry): BufferGeometry {
  const count = geometry.getAttribute('position').count;
  const scalar = (fn: (i: number) => number) => {
    const array = new Float32Array(count);
    for (let i = 0; i < count; ++i) array[i] = fn(i);
    // Float32Array on purpose — doc 22 §4 row 2: three r185 cannot bind a
    // single-component 8-bit attribute on the WebGPU path.
    return new BufferAttribute(array, 1);
  };

  geometry.setAttribute(SKIN_CURVATURE_ATTRIBUTE, scalar((i) => Math.sin(i * 0.11) * 0.5 + 0.5));
  geometry.setAttribute(SKIN_THICKNESS_ATTRIBUTE, scalar((i) => Math.cos(i * 0.07) * 0.5 + 0.5));
  geometry.setAttribute(HAIR_T_ATTRIBUTE, scalar((i) => (i % 64) / 63));
  geometry.setAttribute(HAIR_PHASE_ATTRIBUTE, scalar((i) => (i * 2.399963) % 6.28318));
  geometry.setAttribute(CAVITY_ATTRIBUTE, scalar((i) => (i % 32) / 31));
  geometry.setAttribute(BROW_TIP_ATTRIBUTE, scalar((i) => (i % 16) / 15));

  const aux = new Float32Array(count * 4);
  const rest = new Float32Array(count * 3);
  const position = geometry.getAttribute('position');
  for (let i = 0; i < count; ++i) {
    aux[i * 4] = (position.getX(i) + 1) * 0.5;
    aux[i * 4 + 1] = (position.getY(i) + 1) * 0.5;
    aux[i * 4 + 2] = 0.5;
    aux[i * 4 + 3] = 0.8;
    // Rest position chosen so the denim wear is actually EXERCISED rather than
    // merely present. The first fixture put z at ~0, which drives
    // `clothingFront = smoothstep(-0.015, 0.085, z)` to about 0.17 and damps
    // every wear term to invisibility — the material looked like a flat indigo
    // fill and told us nothing. These ranges put the knee (y 0.31) and hip
    // (y 0.61) gaussians in frame, keep the surface on the front of the leg,
    // and span enough x for the 175-per-radian whisker frequency to show.
    rest[i * 3] = position.getX(i) * 0.09 + 0.13;
    rest[i * 3 + 1] = (position.getY(i) / 1.4 + 0.5) * 1.0;
    rest[i * 3 + 2] = 0.06;
  }
  geometry.setAttribute(EYE_AUX_ATTRIBUTE, new BufferAttribute(aux, 4));
  geometry.setAttribute(GARMENT_REST_ATTRIBUTE, new BufferAttribute(rest, 3));

  // The hair material declares `vertexColors: true`.
  const colors = new Float32Array(count * 3).fill(0.6);
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  // Anisotropy wants an authored tangent — §4 row 5.
  const tangents = new Float32Array(count * 4);
  for (let i = 0; i < count; ++i) {
    tangents[i * 4] = 1;
    tangents[i * 4 + 3] = 1;
  }
  geometry.setAttribute('tangent', new BufferAttribute(tangents, 4));
  return geometry;
}

/**
 * Reads the drawn patch back as RGBA bytes.
 *
 * The WebGL path keeps `gl.readPixels`, which is exact and needs no compositor.
 * WebGPU has no equivalent that reaches the swap-chain texture from JS, so that
 * path copies the canvas into a 2D canvas instead. The row order differs
 * between the two (GL is bottom-up), which does not matter: both callers only
 * take luminance statistics over the whole patch.
 */
function readPixels(
  renderer: WebGPURenderer,
  canvas: HTMLCanvasElement,
  backend: 'webgl' | 'webgpu'
): Uint8ClampedArray | Uint8Array {
  if (backend === 'webgl') {
    const pixels = new Uint8Array(192 * 192 * 4);
    const gl = (renderer as unknown as { backend: { gl: WebGL2RenderingContext } }).backend.gl;
    gl.readPixels(0, 0, 192, 192, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return pixels;
  }
  const scratch = document.createElement('canvas');
  scratch.width = 192;
  scratch.height = 192;
  const context = scratch.getContext('2d');
  if (!context) throw new Error('no 2d context for WebGPU readback');
  context.drawImage(canvas, 0, 0);
  return context.getImageData(0, 0, 192, 192).data;
}

/**
 * Pulls the source three actually emitted for this draw, so the run can prove
 * which language it compiled rather than asserting it from a launch flag.
 * Returns nulls rather than throwing: a shader dump is evidence, not a gate.
 */
async function emittedShader(
  renderer: WebGPURenderer,
  scene: Scene,
  camera: PerspectiveCamera,
  mesh: Mesh
): Promise<{ source: string | null; language: string }> {
  try {
    const debug = (
      renderer as unknown as {
        debug: {
          getShaderAsync: (
            scene: Scene,
            camera: PerspectiveCamera,
            object: Mesh
          ) => Promise<{ fragmentShader?: string }>;
        };
      }
    ).debug;
    const shader = await debug.getShaderAsync(scene, camera, mesh);
    const source = shader.fragmentShader ?? null;
    if (!source) return { source: null, language: 'unknown' };
    // `@fragment` and `fn ` are WGSL-only; `#version 300 es` is GLSL-only.
    const language = /@fragment|fn\s+main/.test(source)
      ? 'wgsl'
      : /#version|void\s+main/.test(source)
        ? 'glsl'
        : 'unknown';
    return { source, language };
  } catch {
    return { source: null, language: 'unknown' };
  }
}

function rig(scene: Scene) {
  // A cut-down version of the stage's five-light rig — enough to exercise the
  // lighting model's `direct()` path, which is what row 1 is really about.
  const key = new RectAreaLight(0xfff1e0, 12, 0.6, 0.9);
  key.position.set(0.6, 0.7, 1.1);
  key.lookAt(0, 0, 0);
  const fill = new RectAreaLight(0xdce8ff, 4, 1.2, 1.2);
  fill.position.set(-0.9, 0.2, 0.8);
  fill.lookAt(0, 0, 0);
  const rim = new RectAreaLight(0xffd9b0, 8, 0.4, 0.8);
  rim.position.set(-0.4, 0.5, -1.0);
  rim.lookAt(0, 0, 0);
  scene.add(key, fill, rim);
}

export async function runProbe(canvas: HTMLCanvasElement): Promise<ProbeResult[]> {
  const backend = selectedBackend();
  const renderer = new WebGPURenderer({
    canvas,
    antialias: false,
    // See the header. `webgl` walks the same node graphs and emits GLSL; only
    // `webgpu` can fail (or pass) on WGSL and on `createRenderPipeline`.
    forceWebGL: backend === 'webgl',
  });
  await renderer.init();

  // Dawn reports most pipeline problems here rather than by throwing, so the
  // listener is installed once and drained per case.
  const device =
    backend === 'webgpu'
      ? (renderer as unknown as { backend: { device?: GPUDevice } }).backend.device
      : undefined;
  let deviceErrors: string[] = [];
  device?.addEventListener('uncapturederror', (event) => {
    deviceErrors.push((event as GPUUncapturedErrorEvent).error.message);
  });

  // Same reason, one layer up: three logs some builder failures instead of
  // throwing them, and a swallowed error must not read as a pass.
  let consoleErrors: string[] = [];
  const realConsoleError = console.error.bind(console);
  console.error = (...parts: unknown[]) => {
    consoleErrors.push(parts.map((part) => String(part)).join(' '));
    realConsoleError(...parts);
  };
  // §4 row 8, and the probe proved it is not advisory: without the LTC lookup
  // textures installed, `RectAreaLightNode.setupDirectRectArea()` dereferences
  // a null and EVERY material that sees a RectAreaLight fails to build. The
  // first run of this probe hit exactly that, which is a good demonstration
  // that the row is a hard dependency rather than a nicety.
  initRectAreaLights();
  renderer.setPixelRatio(1);
  renderer.setSize(192, 192, false);

  const camera = new PerspectiveCamera(35, 1, 0.05, 20);
  camera.position.set(0, 0, 2.2);
  camera.lookAt(0, 0, 0);

  const eyes = makeEyeMaterials({ irisRadius: 0.005265, pupilRadius: 0.00263 });
  const hair = createHairMaterial();
  const denim = createDenimMaterial({ region: { minY: 0, height: 1 }, seed: 7 });
  const mouth = makeMouthMaterials();
  const brow = createBrowMaterial();

  const cases: { id: string; material: unknown; flat?: boolean }[] = [
    { id: 'skin', material: new SkinNodeMaterial({ color: new Color(0x6b4432) }) },
    { id: 'eye-sclera', material: eyes.sclera },
    { id: 'eye-iris', material: eyes.iris },
    { id: 'eye-pupil', material: eyes.pupil },
    { id: 'hair', material: hair.material },
    { id: 'denim', material: denim.material, flat: true },
    { id: 'mouth-teeth', material: mouth.teeth },
    { id: 'mouth-gums', material: mouth.gums },
    { id: 'mouth-tongue', material: mouth.tongue },
    { id: 'brow', material: brow.material, flat: true },
  ];

  const results: ProbeResult[] = [];

  for (const testCase of cases) {
    const scene = new Scene();
    rig(scene);
    const geometry = withAttributes(
      testCase.flat ? new PlaneGeometry(1.4, 1.4, 48, 48) : new SphereGeometry(0.7, 48, 32)
    );
    const mesh = new Mesh(geometry, testCase.material as Mesh['material']);
    scene.add(mesh);

    let error: string | null = null;
    let meanLuma = 0;
    let distinctLuma = 0;
    let png: string | null = null;
    let fragmentShader: string | null = null;
    let shaderLanguage = 'unknown';
    consoleErrors = [];
    deviceErrors = [];

    try {
      hair.update(0.4, 1);
      // Two frames: the first triggers compilation, the second renders with the
      // pipeline already warm. A single frame can report success before the
      // async pipeline creation has actually resolved.
      // Two frames: the first triggers compilation, the second draws with the
      // pipeline warm. `render()` rather than `renderAsync()` — the latter is
      // deprecated now that `init()` is awaited above.
      renderer.render(scene, camera);
      renderer.render(scene, camera);
      // NOTHING may be awaited between the render and the readback on the
      // WebGPU path. A WebGPU canvas texture is invalidated at the end of the
      // task that got it, so an `await` here — the first version of this file
      // awaited the queue — presents the frame and leaves `drawImage` copying
      // transparent black. That reads as "every material drew nothing", which
      // is a readback bug wearing a compile failure's clothes.
      const pixels = readPixels(renderer, canvas, backend);
      png = canvas.toDataURL('image/png');

      // Now it is safe to drain. On Dawn the submission is what actually
      // exercises the pipeline, and the uncaptured-error event only fires once
      // the queue has drained, so without this await a broken pipeline is
      // still in flight when the case is scored.
      if (device) {
        await device.queue.onSubmittedWorkDone();
        await new Promise((settle) => {
          setTimeout(settle, 0);
        });
      }

      const emitted = await emittedShader(renderer, scene, camera, mesh);
      fragmentShader = emitted.source;
      shaderLanguage = emitted.language;

      const seen = new Set<number>();
      let total = 0;
      for (let i = 0; i < 192 * 192; ++i) {
        const luma = Math.round(
          0.299 * (pixels[i * 4] as number) +
            0.587 * (pixels[i * 4 + 1] as number) +
            0.114 * (pixels[i * 4 + 2] as number)
        );
        total += luma;
        seen.add(luma);
      }
      meanLuma = total / (192 * 192);
      distinctLuma = seen.size;
    } catch (thrown) {
      error = thrown instanceof Error ? `${thrown.message}` : String(thrown);
    }

    // A compile failure in three surfaces as a console error rather than a
    // throw on some paths, so the shape of the image is a second signal: a
    // material that "rendered" one flat colour did not shade anything.
    results.push({
      id: testCase.id,
      compiled: error === null && consoleErrors.length === 0 && deviceErrors.length === 0,
      error,
      consoleErrors: [...consoleErrors],
      deviceErrors: [...deviceErrors],
      meanLuma: Math.round(meanLuma * 10) / 10,
      distinctLuma,
      png,
      backendId:
        (renderer as unknown as { backend: { isWebGPUBackend?: boolean } }).backend
          .isWebGPUBackend === true
          ? 'webgpu'
          : 'webgl2',
      shaderLanguage,
      fragmentShader,
    });

    geometry.dispose();
  }

  eyes.dispose();
  hair.dispose();
  denim.dispose();
  mouth.dispose();
  brow.dispose();
  renderer.dispose();
  console.error = realConsoleError;
  return results;
}

declare global {
  interface Window {
    __runProbe: (canvas: HTMLCanvasElement) => Promise<ProbeResult[]>;
  }
}

window.__runProbe = runProbe;
