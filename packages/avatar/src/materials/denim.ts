/**
 * Dark-indigo denim — doc 22 §4 row 6.
 *
 * The whole point of this material is that **the wear does not move.** Knee
 * fade, hip whiskers and the outer-leg felled seam are authored against
 * `garmentRestPosition` — the vertex's position in the SMPL-X *rest* pose,
 * baked once as an attribute — not against `positionLocal`, which is skinned
 * and therefore different every frame. Bend the knee and the fade stays on the
 * knee. Read the skinned position instead and the fade would slide across the
 * fabric like a projected texture, which is the single most obvious way to make
 * clothing look fake.
 *
 * So the port has one hard requirement: `garmentRestPosition` stays a real
 * `vec3` attribute. `attribute('garmentRestPosition', 'vec3')` is the TSL
 * equivalent of the reference's `attribute vec3 garmentRestPosition;` + varying,
 * and TSL hoists the interpolation for us.
 *
 * WHY `colorNode` AND `roughnessNode` ARE EXACT HERE, NOT APPROXIMATE.
 * The reference patched `<map_fragment>` and `<roughnessmap_fragment>`, both of
 * which run *after* `diffuseColor` / `roughnessFactor` have been seeded from
 * `diffuse * map` and `roughness * roughnessMap.g`. In TSL, `colorNode` and
 * `roughnessNode` REPLACE that seeding rather than running after it. That would
 * normally lose the maps — but this material has **no `map` and no
 * `roughnessMap`** (its only texture is a normal map, which is a separate
 * slot). So seeding from `materialColor` / `materialRoughness` reproduces the
 * reference byte for byte. If a diffuse or roughness map is ever added to the
 * jeans, this file must multiply it in explicitly; the assertion in the test
 * exists to make that a loud failure rather than a quiet one.
 *
 * Every constant below is the reference's `patchDenimMaterial`, unchanged:
 * the 0.31/0.61 knee and hip centres, the 0.075 gaussian width, the 175/34
 * whisker frequencies, the 0.72/0.42 wear mix, the 1.55/1.72/1.95 indigo
 * lift, the 0.078→0.105 leg-centre taper, the 0.011/0.016 seam ellipse, the
 * 108-per-metre dash, and the 0.42 roughness floor.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §4 row 6
 * SOT-KEYWORDS: denim jeans clothing wear whisker knee-fade seam stitch rest-position pose-invariant tsl
 */
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import type { Node } from 'three/webgpu';
import {
  abs,
  attribute,
  clamp,
  exp,
  fract,
  length,
  materialColor,
  materialRoughness,
  mix,
  pow,
  sin,
  smoothstep,
  uniform,
  vec2,
  vec3,
} from 'three/tsl';
import { Color, Vector2 } from 'three';

/**
 * Per-vertex rest-pose position, `Float32Array`, itemSize 3. Baked by the
 * garment compiler at bind time and never written again.
 */
export const GARMENT_REST_ATTRIBUTE = 'garmentRestPosition';

type Float = Node<'float'>;
type Vec3 = Node<'vec3'>;
const asFloat = (n: unknown): Float => n as Float;
const asVec3 = (n: unknown): Vec3 => n as Vec3;

/**
 * The body-height normalisation the wear pattern is authored against. `minY` is
 * the garment's lowest rest-pose vertex and `height` the span, so `clothingY`
 * is 0 at the hem and 1 at the waist regardless of the avatar's stature.
 */
export interface DenimRegion {
  minY: number;
  height: number;
}

/**
 * The reference's `seedPhase` — a fixed integer hash, ported verbatim so the
 * same seed produces the same stitch phase as the WebGL build. Determinism is
 * what makes the golden set meaningful, so this must not be "improved".
 */
export function seedPhase(seed: number, channel: number): number {
  let value = (seed ^ Math.imul(channel + 1, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 0x100000000;
}

/** Channel 4 is the stitch phase; the normal-map channels are 0-3. */
export const DENIM_PHASE_CHANNEL = 4;

export function createDenimUniforms(region: DenimRegion, seed: number) {
  return {
    minY: uniform(region.minY),
    height: uniform(region.height),
    phase: uniform(seedPhase(seed, DENIM_PHASE_CHANNEL)),
  };
}

export type DenimUniforms = ReturnType<typeof createDenimUniforms>;

/**
 * The three scalar fields the reference derives once and then uses in both the
 * colour and the roughness patch. They are computed together here for the same
 * reason they were shared there: `clothingWear` and `clothingSeam` each feed
 * two outputs, and recomputing them would let the two drift apart under edits.
 */
interface DenimFields {
  wear: Float;
  seam: Float;
  dash: Float;
}

function denimFields(u: DenimUniforms): DenimFields {
  const rest = asVec3(attribute(GARMENT_REST_ATTRIBUTE, 'vec3'));

  const y = clamp(rest.y.sub(u.minY).div(u.height), 0.0, 1.0);
  // Wear lives on the FRONT of the leg only — jeans do not fade at the back of
  // the knee, because that is where the fabric folds rather than abrades.
  const front = smoothstep(-0.015, 0.085, rest.z);

  const gaussian = (centre: number) =>
    asFloat(exp(pow(y.sub(centre).div(0.075), 2.0).negate()));

  const knee = gaussian(0.31).mul(front);
  const hip = gaussian(0.61).mul(front);
  // Whiskers are the vertical creases that radiate from the hip: a high
  // frequency in x, a low one in y, so they run diagonally like real ones.
  const whisker = sin(rest.x.mul(175.0).add(rest.y.mul(34.0))).mul(0.5).add(0.5);

  const wear = asFloat(clamp(knee.mul(0.72).add(hip.mul(whisker).mul(0.42)), 0.0, 1.0));

  // The outer-leg felled seam. The leg's centre moves outward as you go up the
  // thigh, so the seam's x offset is a taper, not a constant.
  const legCentre = mix(0.078, 0.105, smoothstep(0.18, 0.68, y));
  const seamCoord = vec2(abs(rest.x).sub(legCentre).sub(0.052).div(0.011), rest.z.div(0.016));
  const seam = asFloat(smoothstep(0.68, 1.02, length(seamCoord)).oneMinus());

  // 108 stitches per metre, 20 % duty cycle — a dashed topstitch, not a line.
  const dash = asFloat(smoothstep(0.8, 0.91, fract(rest.y.sub(u.minY).mul(108.0).add(u.phase))));

  return { wear, seam, dash };
}

/**
 * Indigo lift, then topstitch, in that order. The GLSL mutated `diffuseColor`
 * twice in sequence, so the second `mix` reads the ALREADY-LIFTED colour — the
 * stitch sits on top of the whisker, not underneath it. Chaining preserves that;
 * two independent mixes off `materialColor` would not.
 */
export function denimColorNode(u: DenimUniforms): Vec3 {
  const { wear, seam, dash } = denimFields(u);
  const base = asVec3(materialColor);
  const worn = asVec3(mix(base, base.mul(vec3(1.55, 1.72, 1.95)), wear));
  return asVec3(mix(worn, vec3(0.18, 0.068, 0.018), seam.mul(dash).mul(0.32)));
}

/**
 * Abraded denim is *smoother*, not rougher — the nap is worn off — hence the
 * subtraction. The seam adds a little back because a felled seam is four
 * layers of raised fabric. The 0.42 floor stops the wear reading as satin.
 */
export function denimRoughnessNode(u: DenimUniforms): Float {
  const { wear, seam } = denimFields(u);
  return asFloat(
    clamp(materialRoughness.sub(wear.mul(0.09)).add(seam.mul(0.025)), 0.42, 1.0)
  );
}

export interface DenimMaterialOptions {
  /** Rest-pose extent of the garment. Required — the wear is meaningless without it. */
  region: DenimRegion;
  /** Deterministic groom seed. Same seed in, same stitch phase out. */
  seed?: number;
  /** Procedural twill normal map, built by the garment compiler. */
  normalMap?: MeshPhysicalNodeMaterial['normalMap'];
}

export interface DenimMaterial {
  material: MeshPhysicalNodeMaterial;
  uniforms: DenimUniforms;
  dispose(): void;
}

export function createDenimMaterial(options: DenimMaterialOptions): DenimMaterial {
  const uniforms = createDenimUniforms(options.region, options.seed ?? 0);

  const material = new MeshPhysicalNodeMaterial({
    name: 'jeans-dark-indigo-denim',
    color: new Color(0x101e3b),
    roughness: 0.73,
    metalness: 0,
    // Denim is a matte fabric with a faint cool sheen off the twill ridges —
    // that sheen is most of what separates it from painted plastic.
    sheen: 0.24,
    sheenColor: new Color(0x6681a8),
    sheenRoughness: 0.79,
    normalScale: new Vector2(0.12, 0.12),
  });
  if (options.normalMap) material.normalMap = options.normalMap;

  material.colorNode = denimColorNode(uniforms);
  material.roughnessNode = denimRoughnessNode(uniforms);

  // Carried over from the reference so the wardrobe inspector and the golden
  // report can name what they are looking at without re-deriving it.
  material.userData.surface = {
    identity: 'indigo-denim',
    structure: 'twill-normal',
    wear: ['hip-whisker', 'knee-fade'],
    stitch: { pattern: 'outer-leg-dashed', dutyCycle: 0.2, strength: 0.32 },
  };

  return {
    material,
    uniforms,
    dispose() {
      material.dispose();
    },
  };
}
