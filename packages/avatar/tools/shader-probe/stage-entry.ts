/**
 * The stage probe — doc 22 §4 rows 8–12, the post chain.
 *
 * The material probe (`entry.ts`) proved every TSL *material* graph compiles.
 * This one goes after the other half of the risk: `RenderPipeline`, `pass()`,
 * `bloom()`, the GTAO prepass with its MRT, `PMREMGenerator` over
 * `RoomEnvironment`, five `RectAreaLight`s through the LTC path, a shadow-
 * casting directional, and the tone-mapping output transform — all of it built
 * by `createStage()` exactly as the product would build it.
 *
 * Row 11 is the one this is really for. It is marked **High — built, unmatched**
 * in the parity table, and every claim in it (`RenderPipeline` not
 * `PostProcessing`; `bloom()` from `BloomNode.js`; `ao()` from `GTAONode.js`;
 * `builtinAOContext`; no `OutputPass`) is a claim about a graph nobody had
 * built end to end.
 *
 * ── EACH TIER IS A DIFFERENT GRAPH, SO EACH TIER IS A SEPARATE CASE ────────
 *
 * `createStage()` branches on the tier profile: `phone` gets a bare scene pass,
 * `tablet` adds MSAA and bloom, `studio` adds the GTAO prepass. Those are three
 * genuinely different node graphs and a green `studio` says nothing about
 * `phone`. Probing one and assuming the others is how a tier ships broken to
 * the only devices that use it.
 *
 * ── WHAT A FAILURE HERE MEANS, AND WHAT IT DOES NOT ────────────────────────
 *
 * Same caveat as the material probe: this is the WebGL2 backend over
 * SwiftShader, because Playwright's Chromium has WebGPU compiled out. A pass
 * proves the graph is well-formed and every node resolves. It does not prove
 * WGSL, and it emphatically does not prove the look — GTAO especially, which
 * §4 row 11 already warns will not match the reference frames.
 *
 * A failure that is *expected* and still worth recording: some WebGPU-only
 * nodes have no WebGL2 lowering. If GTAO is one of them, that is a fact about
 * the probe's reach rather than a defect in the stage, and the runner reports
 * it as such instead of failing the build over it.
 *
 * ── ONE THING THIS PROBE CANNOT VERIFY: SHADOWS ────────────────────────────
 *
 * No shadow renders here. Not on the stage's `ShadowMaterial` catcher, and —
 * the important part — not on a plain `MeshStandardNodeMaterial` receiver under
 * a strong stock `DirectionalLight` with a tight shadow frustum, which the
 * `control` block below adds precisely to distinguish the two cases. Measured
 * shadow depth under the sphere: 0.1 %.
 *
 * Because the CONTROL fails too, the reading is that shadow mapping does not
 * work on `WebGPURenderer`'s WebGL2 fallback in this environment — a limit of
 * the probe, not evidence about the stage. §4 row 10 (`PCFShadowMap`) therefore
 * stays unverified and needs a WebGPU device. It is at least now a specific
 * question rather than a vague one.
 *
 * That said, the investigation was not wasted: chasing it found a real bug in
 * `stage.ts` — the shadow catcher's Y was hardcoded to -1.45 and never tracked
 * `focus`, so with the default framing it sat 1.45 m below the floor and the
 * shadow fell on nothing. Wrong on every backend. Fixed, with tests.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §4 rows 8-12, §6
 * SOT-KEYWORDS: stage probe renderpipeline bloom gtao mrt pmrem rectarealight shadow tonemapping tiers
 */
import {
  Color,
  DirectionalLight,
  Mesh,
  PlaneGeometry,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  Vector3,
} from 'three';
import { MeshStandardNodeMaterial, WebGPURenderer } from 'three/webgpu';
import { createStage } from '../../src/stage.ts';
import { TIER_PROFILES } from '../../src/tiers.ts';
import { SkinNodeMaterial } from '../../src/materials/skin.ts';
import { SKIN_CURVATURE_ATTRIBUTE, SKIN_THICKNESS_ATTRIBUTE } from '../../src/materials/skin.ts';
import { BufferAttribute } from 'three';
import type { Tier } from '../../src/tiers.ts';

export interface StageProbeResult {
  tier: string;
  built: boolean;
  rendered: boolean;
  error: string | null;
  meanLuma: number;
  distinctLuma: number;
  drawCalls: number;
  png: string | null;
}

/** Where the fixture's ground sits — a standing height below the sphere "head". */
export const PROBE_GROUND_Y = 1.36;

/** A head-sized sphere over a floor — enough to exercise shadows and AO. */
function buildScene(): { scene: Scene; camera: PerspectiveCamera } {
  const scene = new Scene();

  const head = new SphereGeometry(0.11, 48, 32);
  const count = head.getAttribute('position').count;
  const curvature = new Float32Array(count).fill(0.5);
  const thickness = new Float32Array(count).fill(0.4);
  head.setAttribute(SKIN_CURVATURE_ATTRIBUTE, new BufferAttribute(curvature, 1));
  head.setAttribute(SKIN_THICKNESS_ATTRIBUTE, new BufferAttribute(thickness, 1));

  const mesh = new Mesh(head, new SkinNodeMaterial({ color: new Color(0x6b4432) }));
  mesh.position.set(0, 1.5, 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  // A LIT floor at the catcher's height, in addition to the stage's own
  // invisible catcher. Without it the shadow is unmeasurable: the stage
  // background is 0x0b0d10, which tone-maps to a luminance of about 1.8, and a
  // 35 %-opacity black shadow over near-black is nothing. That is a fixture
  // problem, not a stage one — in product the avatar sits on a designed
  // backdrop (doc 23), not a void — but it means the probe needs a receiver it
  // can actually measure.
  // No lit floor: the stage's own invisible `ShadowMaterial` catcher IS the
  // grounding mechanism, and adding a second receiver only confuses the
  // measurement. A first attempt used one and measured the floor UNDER the
  // sphere as brighter than at the sides — which is light falloff, not a
  // shadow, because the shadow-casting directional carries 0.35 intensity
  // against RectAreaLights at 12: on a lit surface it can darken by a couple of
  // per cent. On the catcher, which draws shadow independently of scene
  // lighting, it is fully visible. Understanding that distinction is the
  // difference between "the shadow is broken" and "you measured the wrong
  // surface". The stage supplies its own invisible
  // `ShadowMaterial` catcher — that is the whole grounding mechanism, and
  // adding a lit floor would hide whether the catcher is where it should be.
  // The first version of this fixture had one, which is part of why the missing
  // contact shadow read as ambiguous.
  //
  // The camera is pitched down so the ground plane is actually in frame. Framed
  // level, as it was, the catcher could be metres out of place and the render
  // would look identical.
  const camera = new PerspectiveCamera(38, 1, 0.05, 20);
  camera.position.set(0.18, 1.62, 0.52);
  camera.lookAt(0, 1.44, 0);
  return { scene, camera };
}

export async function runStageProbe(host: HTMLElement): Promise<StageProbeResult[]> {
  const results: StageProbeResult[] = [];
  // `presence-2d` renders nothing by definition — it is the tier that has no
  // stage — so it is not a case here.
  const tiers: Tier[] = ['phone', 'tablet', 'studio'];

  for (const tier of tiers) {
    let built = false;
    let rendered = false;
    let error: string | null = null;
    let meanLuma = 0;
    let distinctLuma = 0;
    let drawCalls = 0;
    let png: string | null = null;
    let renderer: WebGPURenderer | null = null;

    let canvas: HTMLCanvasElement | null = null;
    try {
      // A FRESH canvas per tier. Reusing one across `renderer.dispose()` loses
      // the WebGL context, and the next `renderer.init()` then dies inside
      // `WebGLState._init` with "Cannot read properties of null" — which reads
      // exactly like a broken node graph and is nothing of the kind. The first
      // run of this probe reported tablet and studio as build failures for
      // precisely that reason. A probe that misattributes its own bugs to the
      // thing under test is worse than no probe.
      canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      host.appendChild(canvas);

      renderer = new WebGPURenderer({ canvas, antialias: false, forceWebGL: true });
      await renderer.init();
      renderer.setPixelRatio(1);
      renderer.setSize(256, 256, false);

      const { scene, camera } = buildScene();
      // The sphere's centre is the "head", so the ground belongs a standing
      // height below it — which is exactly what `groundYFor` computes and what
      // the hardcoded catcher used to get wrong.
      const stage = createStage({
        renderer,
        scene,
        camera,
        profile: TIER_PROFILES[tier],
        focus: new Vector3(0, 1.5, 0),
        groundY: PROBE_GROUND_Y,
      });
      built = true;

      // The catcher renders shadow at 35 % opacity over WHATEVER IS BEHIND IT,
      // which the stage sets to 0x0b0d10 — a luminance of about 1.8 after tone
      // mapping. Black-on-black is unmeasurable, so the probe lifts the
      // background to a mid grey. This is a measurement choice, not a change to
      // the stage: the product puts the avatar on a designed backdrop (doc 23),
      // and this makes the same shadow legible to a pixel test.
      scene.background = new Color(0x6a6258);

      // A CONTROL. The question "is the contact shadow missing" has two very
      // different answers — the stage's catcher is not receiving, or shadows do
      // not work on this backend at all — and they need different fixes. So the
      // probe adds its own strong shadow-caster and a plain lit receiver: if a
      // shadow appears HERE and not on the catcher, shadows work and the
      // catcher is the problem; if neither shows one, the backend is.
      const control = new DirectionalLight(0xffffff, 6);
      control.position.set(0.9, 2.6, 0.9);
      control.target.position.set(0, 1.44, 0);
      control.target.updateMatrixWorld();
      control.castShadow = true;
      control.shadow.mapSize.set(1024, 1024);
      control.shadow.camera.near = 0.2;
      control.shadow.camera.far = 4;
      control.shadow.camera.left = -0.6;
      control.shadow.camera.right = 0.6;
      control.shadow.camera.top = 0.6;
      control.shadow.camera.bottom = -0.6;
      scene.add(control, control.target);

      const controlFloor = new Mesh(
        new PlaneGeometry(2, 2),
        new MeshStandardNodeMaterial({ color: new Color(0x8a8078), roughness: 0.9 })
      );
      controlFloor.rotation.x = -Math.PI / 2;
      controlFloor.position.set(0, PROBE_GROUND_Y, 0);
      controlFloor.receiveShadow = true;
      scene.add(controlFloor);

      // Two frames: the first compiles, the second draws warm.
      stage.render();
      stage.render();
      rendered = true;
      drawCalls = stage.stats.drawCalls;

      const gl = (renderer as unknown as { backend: { gl: WebGL2RenderingContext } }).backend.gl;
      const pixels = new Uint8Array(256 * 256 * 4);
      gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      const seen = new Set<number>();
      let total = 0;
      for (let i = 0; i < 256 * 256; ++i) {
        const luma = Math.round(
          0.299 * (pixels[i * 4] as number) +
            0.587 * (pixels[i * 4 + 1] as number) +
            0.114 * (pixels[i * 4 + 2] as number)
        );
        total += luma;
        seen.add(luma);
      }
      meanLuma = Math.round((total / (256 * 256)) * 10) / 10;
      distinctLuma = seen.size;
      png = canvas.toDataURL('image/png');

      stage.dispose();
    } catch (thrown) {
      // The stack matters more than the message here: "Cannot read properties
      // of null" from inside a node graph is meaningless without the frame that
      // produced it, and the whole point of a probe is to say WHICH node broke.
      error =
        thrown instanceof Error
          ? `${thrown.message}\n${(thrown.stack ?? '').split('\n').slice(1, 7).join('\n')}`
          : String(thrown);
    } finally {
      renderer?.dispose();
      canvas?.remove();
    }

    results.push({ tier, built, rendered, error, meanLuma, distinctLuma, drawCalls, png });
  }

  return results;
}

declare global {
  interface Window {
    __runStageProbe: (host: HTMLElement) => Promise<StageProbeResult[]>;
  }
}

window.__runStageProbe = runStageProbe;
