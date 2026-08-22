/**
 * Braided hair — doc 22 §4 rows 4 and 5.
 *
 * TWO THINGS HERE ARE EASY TO GET WRONG, AND BOTH ARE SILENT.
 *
 * **1. `positionNode` REPLACES the position, it does not offset it.**
 * `NodeMaterial.setupPosition()` applies morph targets, then skinning, then
 * displacement, then batching, then instancing — each MUTATING `positionLocal`
 * in place — and only then assigns `positionNode` over the top. So writing
 *
 *     material.positionNode = sway            // WRONG — destroys skinning
 *
 * silently discards everything upstream, while
 *
 *     material.positionNode = positionLocal.add(sway)   // right
 *
 * composes. The braids hang off the SMPL-X head bone, so this is the difference
 * between hair that follows the head and hair that stays where the bind pose
 * left it. (The one time a bare assignment is correct is when a compute pass
 * already did the skinning — doc 22 §4 row 14.)
 *
 * **2. The secondary motion costs zero CPU.** Roots are pinned and tips sway,
 * entirely in the vertex stage, driven by two uniforms. The reference has a
 * test asserting no geometry is rebuilt per frame, and that property is the
 * whole reason a 250-braid groom is affordable on a phone — it must survive
 * the port. `update()` writes two uniforms and nothing else.
 *
 * ANISOTROPY (row 5): `anisotropy > 0` alone flips `useAnisotropy` on
 * `MeshPhysicalNodeMaterial`, which routes `BRDF_GGX` through its anisotropic
 * branch. The authored `tangent` vec4 attribute is used directly; without it
 * three falls back to a screen-derivative frame, which is fine for surfaces and
 * wrong for hair — so the groom must keep authoring tangents.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §4 rows 4-5
 * SOT-KEYWORDS: hair braids sway secondary motion positionnode anisotropy tangent debug tsl
 */
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import type { Node } from 'three/webgpu';
import {
  attribute,
  float,
  materialColor,
  mix,
  positionLocal,
  sin,
  smoothstep,
  uniform,
  vec3,
} from 'three/tsl';
import { Color, Vector2 } from 'three';

/** Normalised distance along a braid: 0 at the root, 1 at the tip. */
export const HAIR_T_ATTRIBUTE = 'aHairT';
/** Per-strand phase offset, so no two braids move together. */
export const HAIR_PHASE_ATTRIBUTE = 'aHairPhase';

type Float = Node<'float'>;
type Vec3 = Node<'vec3'>;
const asFloat = (n: unknown): Float => n as Float;
const asVec3 = (n: unknown): Vec3 => n as Vec3;

export type HairDebugMode = 'none' | 'flow' | 'motion' | 'roots';

const DEBUG_CODE: Readonly<Record<HairDebugMode, number>> = Object.freeze({
  none: 0,
  flow: 1,
  motion: 2,
  roots: 3,
});

export function createHairUniforms() {
  return {
    time: uniform(0),
    /** Maximum sway at a free tip, in metres: (x, z). */
    sway: uniform(new Vector2(0.006, 0.004)),
    debug: uniform(0),
  };
}

export type HairUniforms = ReturnType<typeof createHairUniforms>;

/**
 * The sway offset. Roots are pinned by construction: `smoothstep(0.08, 1)`
 * squared means the first 8% of every braid contributes nothing and the falloff
 * is quadratic, so a braid bends rather than pivoting at the scalp.
 *
 * Two incommensurate sine terms per axis — 1.27/0.71 on x, 0.93 on z — so the
 * motion never visibly repeats.
 */
export function hairSwayNode(u: HairUniforms): Vec3 {
  const t = asFloat(attribute(HAIR_T_ATTRIBUTE, 'float'));
  const phase = asFloat(attribute(HAIR_PHASE_ATTRIBUTE, 'float'));

  const free = smoothstep(0.08, 1.0, t);
  const weight = free.mul(free);

  const x = sin(u.time.mul(1.27).add(phase))
    .mul(0.65)
    .add(sin(u.time.mul(0.71).add(phase.mul(1.73))).mul(0.35));
  const z = sin(u.time.mul(0.93).add(phase).add(0.8));

  return asVec3(vec3(u.sway.x.mul(weight).mul(x), float(0), u.sway.y.mul(weight).mul(z)));
}

/**
 * Material diagnostics, as a node rather than a branchy `if` chain. `flow`
 * shows the root→tip gradient, `motion` shows the sway weight, `roots` marks
 * the pinned band red — the three things that go wrong in a groom.
 */
function hairDebugColorNode(u: HairUniforms, base: Vec3): Vec3 {
  const t = asFloat(attribute(HAIR_T_ATTRIBUTE, 'float'));
  const flow = asVec3(mix(vec3(0.05, 0.2, 0.9), vec3(1.0, 0.18, 0.04), t));
  const weight = smoothstep(0.08, 1.0, t);
  const motion = asVec3(vec3(weight.mul(weight)));
  const roots = asVec3(mix(vec3(1.0, 0.05, 0.02), vec3(0.025), smoothstep(0.079, 0.081, t)));

  // Nested selects rather than a chain of comparisons: the debug uniform is a
  // small integer and every branch is cheap, so this reads as a lookup.
  const isRoots = u.debug.greaterThan(2.5);
  const isMotion = u.debug.greaterThan(1.5);
  const isFlow = u.debug.greaterThan(0.5);
  return asVec3(
    isRoots.select(roots, isMotion.select(motion, isFlow.select(flow, base)))
  );
}

export interface HairMaterialOptions {
  hairColor?: Color;
  /** Anisotropy strength. Non-zero is what enables the anisotropic BRDF. */
  anisotropy?: number;
  anisotropyRotation?: number;
  clearcoat?: number;
}

export interface HairMaterial {
  material: MeshPhysicalNodeMaterial;
  uniforms: HairUniforms;
  /**
   * Advances the secondary motion. Writes two uniforms — NO geometry work.
   * `timeSeconds` must be monotonic; `motionScale` damps the sway (0 pins it,
   * which is what reduced motion asks for).
   */
  update(timeSeconds: number, motionScale?: number): void;
  setDebugMode(mode: HairDebugMode): void;
  dispose(): void;
}

export function createHairMaterial(options: HairMaterialOptions = {}): HairMaterial {
  const uniforms = createHairUniforms();
  const baseSway = uniforms.sway.value.clone();

  const material = new MeshPhysicalNodeMaterial({
    color: options.hairColor ?? new Color(0x2a2320),
    roughness: 0.36,
    metalness: 0,
    // Row 5: a non-zero anisotropy is what flips `useAnisotropy`, which routes
    // BRDF_GGX through D_GGX_Anisotropic. The groom's authored `tangent` vec4
    // gives it a real direction to be anisotropic ALONG.
    anisotropy: options.anisotropy ?? 0.88,
    anisotropyRotation: options.anisotropyRotation ?? 0,
    clearcoat: options.clearcoat ?? 0.08,
    vertexColors: true,
  });

  // Row 4: compose, never replace.
  material.positionNode = positionLocal.add(hairSwayNode(uniforms));
  // The base MUST be `materialColor`, not a constant.
  //
  // `colorNode` REPLACES the material's colour rather than tinting it, so
  // seeding the debug lookup with `vec3(1,1,1)` — as the first version of this
  // file did — silently discards `options.hairColor` and renders 250 braids of
  // WHITE hair. Nothing throws, nothing fails a unit test, and the constructor
  // argument goes on looking as though it works. The shader probe caught it on
  // its first real render (mean luminance 177 on a material asking for
  // 0x2a2320), which is exactly the class of bug a graph that only ever gets
  // constructed cannot surface.
  material.colorNode = hairDebugColorNode(uniforms, asVec3(materialColor));

  return {
    material,
    uniforms,

    update(timeSeconds: number, motionScale = 1) {
      uniforms.time.value = timeSeconds;
      uniforms.sway.value.set(baseSway.x * motionScale, baseSway.y * motionScale);
    },

    setDebugMode(mode: HairDebugMode) {
      uniforms.debug.value = DEBUG_CODE[mode];
    },

    dispose() {
      material.dispose();
    },
  };
}
