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
 * ── WHY WebGL2 AND NOT WebGPU, AND WHAT THAT COSTS ──────────────────────────
 *
 * `WebGPURenderer` has two backends. Given `forceWebGL: true` it walks the same
 * node graphs and emits GLSL instead of WGSL. That matters here because the
 * only WebGPU-capable environment available is a headless Chromium build with
 * WebGPU compiled out — so the choice is between a WebGL2 run and no run at all.
 *
 * Be precise about what a green result does and does not mean:
 *
 *   PROVEN by a WebGL2 pass — the node graph is well-formed and the builder can
 *   resolve every node, every attribute and every uniform in it. A malformed
 *   graph fails on both backends, and that is the failure mode this port is
 *   most exposed to (rows 1, 3 and 11 are all "built, look unverified").
 *
 *   NOT PROVEN — WGSL-specific compilation, anything about the compute path
 *   (WebGL2 has no compute, so §4 row 14 stays entirely unverified here), and
 *   the LOOK. SwiftShader is a software rasteriser; its output is not a golden
 *   and must never be checked in as one.
 *
 * So this is a compile gate, not the golden gate. It retires a different risk
 * than §10.5 does, and it retires it today.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §4, §10.5
 * SOT-KEYWORDS: shader probe compile tsl webgl2 swiftshader headless verification materials
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
  /** Mean luminance of the rendered patch, 0-255. Catches an all-black draw. */
  meanLuma: number;
  /** Distinct 8-bit luminance values. 1 means a flat fill — i.e. nothing shaded. */
  distinctLuma: number;
  /** The rendered patch as a data URL, so a person can look at it. */
  png: string | null;
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
  const renderer = new WebGPURenderer({
    canvas,
    antialias: false,
    // See the header: WebGPU is unavailable here, and this backend still walks
    // the same node graphs.
    forceWebGL: true,
  });
  await renderer.init();
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

      const pixels = new Uint8Array(192 * 192 * 4);
      const gl = (renderer as unknown as { backend: { gl: WebGL2RenderingContext } }).backend.gl;
      gl.readPixels(0, 0, 192, 192, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

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
      // Read back through the canvas rather than re-encoding the raw buffer:
      // this is a look-at-it artefact, not a golden, and it must never be
      // checked in as one (SwiftShader is a software rasteriser).
      png = canvas.toDataURL('image/png');
    } catch (thrown) {
      error = thrown instanceof Error ? `${thrown.message}` : String(thrown);
    }

    // A compile failure in three surfaces as a console error rather than a
    // throw on some paths, so the shape of the image is a second signal: a
    // material that "rendered" one flat colour did not shade anything.
    results.push({
      id: testCase.id,
      compiled: error === null,
      error,
      meanLuma: Math.round(meanLuma * 10) / 10,
      distinctLuma,
      png,
    });

    geometry.dispose();
  }

  eyes.dispose();
  hair.dispose();
  denim.dispose();
  mouth.dispose();
  brow.dispose();
  renderer.dispose();
  return results;
}

declare global {
  interface Window {
    __runProbe: (canvas: HTMLCanvasElement) => Promise<ProbeResult[]>;
  }
}

window.__runProbe = runProbe;
