/**
 * The stage: lighting rig, IBL, shadows, tone mapping, and the post chain.
 *
 * This is doc 22 §4 rows 8-12 — the other half of the rewrite. The reference
 * drove an `EffectComposer` (`RenderPass → SSAOPass → UnrealBloomPass →
 * OutputPass`) and read `THREE.ShaderChunk` at runtime. On WebGPU none of that
 * exists; the pipeline is a node graph.
 *
 * DEEP-SKIN LIGHTING LAWS, carried over unchanged because they are the reason
 * the character reads at all: the rig is deliberately rim + fill so the shadow
 * side of a brown face keeps STRUCTURE. IBL is low-intensity ambient fill and
 * never the key. A broad warm under-bounce keeps the jaw underside alive.
 * Blacks must never crush — the tone-mapping choice was A/B'd against
 * shadow-side facial structure, not taste.
 *
 * FOUR THINGS THAT ARE NOT LIKE THE REFERENCE, each forced:
 *
 *   `RenderPipeline`, not `PostProcessing` — renamed in r183; the old name is
 *   a deprecation shim due for removal around r193.
 *
 *   `PCFShadowMap`, not `PCFSoftShadowMap` — r185 honours the soft variant on
 *   WebGPU and r186 REMOVES it and throws. PCF is soft in r186 and identical on
 *   WebGL, so it is the only value that survives the bump unchanged.
 *
 *   `ao()` (GTAO), not an SSAO look-alike — the only AO node at r185, and it
 *   needs a depth+normal MRT prepass, which is why it is the studio tier only.
 *   It is wired through `builtinAOContext`, which injects occlusion into the
 *   material's INDIRECT term rather than multiplying the composite. That is
 *   physically better and it will NOT match the reference frames; expect a
 *   re-tune and treat "the port looks wrong" reports against this first. GTAO
 *   is also temporally noisy — three's own example pairs it with `traa()`, and
 *   whether this look needs that is open (doc 22 §11).
 *
 *   No `OutputPass` — `RenderPipeline.outputColorTransform` is true by default
 *   and applies `renderOutput()` from `renderer.toneMapping` /
 *   `renderer.outputColorSpace` automatically.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §4 rows 8-12, §6
 * SOT-KEYWORDS: stage lighting rectarealight ltc pmrem ibl shadows tone mapping renderpipeline bloom gtao
 */
import {
  ACESFilmicToneMapping,
  AgXToneMapping,
  Color,
  DirectionalLight,
  Mesh,
  PCFShadowMap,
  PlaneGeometry,
  RectAreaLight,
  SRGBColorSpace,
  ShadowMaterial,
  Vector3,
} from 'three';
import { PMREMGenerator, RectAreaLightNode, RenderPipeline } from 'three/webgpu';
import type { Camera, Scene, WebGPURenderer } from 'three/webgpu';
import {
  builtinAOContext,
  mrt,
  normalView,
  packNormalToRGB,
  pass,
  sample,
  screenUV,
  unpackRGBToNormal,
} from 'three/tsl';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightTexturesLib } from 'three/examples/jsm/lights/RectAreaLightTexturesLib.js';
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js';
import { ao } from 'three/examples/jsm/tsl/display/GTAONode.js';
import type { TierProfile } from './tiers.ts';

// ---------------------------------------------------------------------------
// Tone mapping. Nothing stays at renderer defaults — output colour space and
// tone mapping are always set explicitly.

export const TONE_MAPPING_CHOICES = {
  // Exposure is per-curve: AgX has a gentler shoulder and darker mids than
  // ACES, so it needs more exposure to land the same key-side skin values.
  acesfilmic: { toneMapping: ACESFilmicToneMapping, exposure: 1.05 },
  agx: { toneMapping: AgXToneMapping, exposure: 1.15 },
} as const;

export type ToneMappingName = keyof typeof TONE_MAPPING_CHOICES;

/**
 * DELIBERATE, and the reasoning is kept because it is the kind of decision that
 * gets silently reversed: measured on the face at the same frame, AgX lifts the
 * shadow-side cheek harder (p5 luminance 91 vs ACES 69) but pays in chroma —
 * relative saturation drops to ~0.34-0.40 against ACES's ~0.47-0.55, and the
 * brown skin reads grey-tan, off-character. ACES under THIS rig does not crush:
 * the cool fill plus the warm under-bounce hold the shadow-side cheek at p5 69,
 * where the old directional-only rig sat at 40. ACES wins for this character;
 * AgX stays one parameter away.
 */
export const DEFAULT_TONE_MAPPING: ToneMappingName = 'acesfilmic';
export const OUTPUT_COLOR_SPACE = SRGBColorSpace;

export function chooseToneMapping(name: string | null | undefined): ToneMappingName {
  return name === 'agx' ? 'agx' : DEFAULT_TONE_MAPPING;
}

export function applyToneMapping(renderer: WebGPURenderer, name?: string | null): ToneMappingName {
  const choice = chooseToneMapping(name);
  const { toneMapping, exposure } = TONE_MAPPING_CHOICES[choice];
  renderer.toneMapping = toneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.outputColorSpace = OUTPUT_COLOR_SPACE;
  return choice;
}

// ---------------------------------------------------------------------------
// The rig.

interface LightSpec {
  role: string;
  color: number;
  intensity: number;
  width: number;
  height: number;
  offset: readonly [number, number, number];
}

/** Five area lights, unchanged from the reference — the look depends on them. */
export const RIG: readonly LightSpec[] = Object.freeze([
  { role: 'warm key, camera-right-high', color: 0xfff1e0, intensity: 3.2, width: 1.0, height: 0.7, offset: [0.75, 0.55, 0.95] },
  { role: 'cool fill, camera-left-low', color: 0x9ec0ff, intensity: 0.8, width: 1.5, height: 1.5, offset: [-1.15, -0.1, 0.85] },
  { role: 'warm rim behind', color: 0xffd2a1, intensity: 3.5, width: 0.6, height: 1.1, offset: [-0.6, 0.4, -1.15] },
  { role: 'cool rim behind', color: 0xaac8ff, intensity: 1.8, width: 0.5, height: 1.0, offset: [0.7, 0.3, -1.2] },
  { role: 'warm under-bounce', color: 0xffc9a0, intensity: 0.5, width: 1.8, height: 1.2, offset: [0, -0.85, 0.75] },
]);

/**
 * LTC lookup textures for the area lights. NOT auto-loaded, and the lib is
 * RENAMED on this path — `RectAreaLightTexturesLib`, not the WebGL-era
 * `RectAreaLightUniformsLib`. Float vs half-float LTC is chosen automatically
 * from `float32Filterable`, which mobile adapters commonly lack; the half path
 * is untested for this look (doc 22 §11).
 */
let ltcReady = false;
export function initRectAreaLights(): void {
  if (ltcReady) return;
  RectAreaLightNode.setLTC(RectAreaLightTexturesLib.init());
  ltcReady = true;
}

export interface StageStats {
  /** EMA of frame-to-frame delta in ms — the input to tier demotion. */
  frameMs: number;
  drawCalls: number;
}

export interface Stage {
  render(): void;
  /** Re-aims every light once the framing is measured. */
  setFocus(focus: Vector3): void;
  setSize(width: number, height: number): void;
  readonly stats: StageStats;
  dispose(): void;
}

export interface StageOptions {
  renderer: WebGPURenderer;
  scene: Scene;
  camera: Camera;
  profile: TierProfile;
  toneMapping?: string | null;
  /** Head height in metres; the rig is aimed relative to it. */
  focus?: Vector3;
  /**
   * World Y of the ground the contact shadow lands on. Defaults to
   * `focus.y - STANDING_HEAD_HEIGHT`, i.e. the floor a standing avatar whose
   * head is at `focus` would be on.
   */
  groundY?: number;
}

/**
 * Head height of the SMPL-X female standing on y = 0. The shadow catcher is
 * placed relative to `focus` through this, so a stage framed on a seated or
 * child-height avatar still puts the ground under the feet.
 */
export const STANDING_HEAD_HEIGHT = 1.45;

/**
 * Where the shadow catcher goes, given the framing.
 *
 * Extracted as a pure function so it can be tested — `createStage()` itself
 * needs a live renderer (`PMREMGenerator`, `pass()`), which is why this file's
 * suite tests decisions rather than devices. The decision is: the ground is a
 * standing height below the head, unless the caller says otherwise.
 */
export function groundYFor(focus: Vector3, groundY?: number): number {
  return groundY ?? focus.y - STANDING_HEAD_HEIGHT;
}

export function createStage(options: StageOptions): Stage {
  const { renderer, scene, camera, profile } = options;

  applyToneMapping(renderer, options.toneMapping);
  initRectAreaLights();

  // Shadows: PCF, never PCFSoft — see the file header.
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;

  let focus = options.focus?.clone() ?? new Vector3(0, STANDING_HEAD_HEIGHT, 0);
  const groundY = options.groundY;

  const lights = RIG.map((spec) => {
    const light = new RectAreaLight(spec.color, spec.intensity, spec.width, spec.height);
    scene.add(light);
    return { light, offset: spec.offset };
  });

  // RectAreaLight cannot cast shadows, so the contact shadow comes from one
  // soft directional key aimed along the warm key. It carries almost no
  // intensity — its whole job is the shadow.
  const shadowKey = new DirectionalLight(0xfff1e0, 0.35);
  shadowKey.castShadow = true;
  shadowKey.shadow.mapSize.set(2048, 2048);
  shadowKey.shadow.bias = -0.00005;
  shadowKey.shadow.radius = 2;
  shadowKey.shadow.camera.near = 0.5;
  shadowKey.shadow.camera.far = 3.0;
  shadowKey.shadow.camera.left = -1.5;
  shadowKey.shadow.camera.right = 1.5;
  shadowKey.shadow.camera.top = 1.5;
  shadowKey.shadow.camera.bottom = -1.5;
  scene.add(shadowKey);

  // An invisible catcher, so the avatar is grounded without a visible floor.
  const catcher = new Mesh(
    new PlaneGeometry(12, 12),
    new ShadowMaterial({ color: 0x000000, opacity: 0.35 })
  );
  catcher.rotation.x = -Math.PI / 2;
  catcher.receiveShadow = true;
  scene.add(catcher);

  // IBL: ambient FILL only, never the key. PMREMGenerator on this path is a
  // DIFFERENT CLASS from the WebGL one — it comes from three/webgpu.
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  scene.environmentIntensity = 0.18;
  room.dispose();
  pmrem.dispose();

  scene.background = new Color(0x0b0d10);

  const aim = (): void => {
    for (const { light, offset } of lights) {
      light.position.copy(focus).add(new Vector3(offset[0], offset[1], offset[2]));
      light.lookAt(focus);
    }
    shadowKey.position.copy(focus).add(new Vector3(0.75, 1.1, 0.95));
    shadowKey.target.position.copy(focus);
    shadowKey.target.updateMatrixWorld();

    // THE CATCHER MUST MOVE WITH THE FOCUS.
    //
    // This was a hardcoded `catcher.position.y = -1.45` set once at
    // construction, which is only correct for a scene whose head sits at the
    // origin. With the default focus of (0, 1.45, 0) — a standing avatar with
    // its feet on y = 0 — it put the ground 1.45 m BELOW the floor, so the
    // contact shadow landed on a plane nobody could see and the avatar read as
    // floating. Nothing threw; the shadow map was rendered correctly and cast
    // onto nothing. `setFocus()` did not move it either, so re-framing the shot
    // silently detached the shadow from the feet.
    //
    // The stage probe found it: no contact shadow in any tier's frame.
    catcher.position.y = groundYFor(focus, groundY);
  };
  aim();

  // The post chain. `pass()` already defaults to HalfFloatType, so the
  // reference's explicit HalfFloat target needs no equivalent — only the
  // sample count, which is the tier's call.
  const pipeline = new RenderPipeline(renderer);
  const scenePass = pass(scene, camera, { samples: profile.samples });

  if (profile.ambientOcclusion) {
    // GTAO needs depth and normals, which means a second, opaque-only pass
    // writing them through MRT. This is the cost the studio tier pays and the
    // reason AO is not on the tablet tier.
    const prePass = pass(scene, camera);
    prePass.transparent = false;
    prePass.setMRT(mrt({ output: packNormalToRGB(normalView) }));
    const prePassNormal = sample((uv) => unpackRGBToNormal(prePass.getTextureNode().sample(uv)));
    const prePassDepth = prePass.getTextureNode('depth');

    // The architectural difference from SSAOPass, and the thing to remember
    // when the port "looks wrong": `builtinAOContext` injects occlusion into
    // the material's INDIRECT term rather than multiplying the final image. It
    // is physically better placed and it will not match the reference frames.
    const aoPass = ao(prePassDepth, prePassNormal, camera);
    scenePass.contextNode = builtinAOContext(aoPass.getTextureNode().sample(screenUV).r);
  }

  // Bloom threshold sits at 1.0 in linear HDR so only true speculars bloom —
  // a lower threshold blooms skin, which is exactly the plastic look the BRDF
  // work exists to avoid.
  pipeline.outputNode = profile.bloom ? scenePass.add(bloom(scenePass, 0.12, 0.2, 1.0)) : scenePass;

  const stats: StageStats = { frameMs: 0, drawCalls: 0 };
  let last = 0;

  return {
    stats,

    render(): void {
      const now = performance.now();
      if (last !== 0) {
        const delta = now - last;
        stats.frameMs = stats.frameMs === 0 ? delta : stats.frameMs + (delta - stats.frameMs) * 0.1;
      }
      last = now;

      // autoReset would wipe the counters between the pipeline's internal
      // passes, so the number reported would be the last pass rather than the
      // frame. Reset once, here, deliberately.
      renderer.info.autoReset = false;
      renderer.info.reset();
      pipeline.render();
      stats.drawCalls = renderer.info.render.drawCalls;
    },

    setFocus(next: Vector3): void {
      focus = next.clone();
      aim();
    },

    setSize(width: number, height: number): void {
      renderer.setSize(width, height, false);
    },

    dispose(): void {
      for (const { light } of lights) scene.remove(light);
      scene.remove(shadowKey);
      scene.remove(catcher);
      catcher.geometry.dispose();
      catcher.material.dispose();
      scene.environment?.dispose();
      scene.environment = null;
    },
  };
}
