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
/**
 * Per-vertex rest-pose position, `Float32Array`, itemSize 3. Baked by the
 * garment compiler at bind time and never written again.
 */
export declare const GARMENT_REST_ATTRIBUTE = "garmentRestPosition";
type Float = Node<'float'>;
type Vec3 = Node<'vec3'>;
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
export declare function seedPhase(seed: number, channel: number): number;
/** Channel 4 is the stitch phase; the normal-map channels are 0-3. */
export declare const DENIM_PHASE_CHANNEL = 4;
export declare function createDenimUniforms(region: DenimRegion, seed: number): {
    minY: import("three/webgpu").UniformNode<"float", number>;
    height: import("three/webgpu").UniformNode<"float", number>;
    phase: import("three/webgpu").UniformNode<"float", number>;
};
export type DenimUniforms = ReturnType<typeof createDenimUniforms>;
/**
 * Indigo lift, then topstitch, in that order. The GLSL mutated `diffuseColor`
 * twice in sequence, so the second `mix` reads the ALREADY-LIFTED colour — the
 * stitch sits on top of the whisker, not underneath it. Chaining preserves that;
 * two independent mixes off `materialColor` would not.
 */
export declare function denimColorNode(u: DenimUniforms): Vec3;
/**
 * Abraded denim is *smoother*, not rougher — the nap is worn off — hence the
 * subtraction. The seam adds a little back because a felled seam is four
 * layers of raised fabric. The 0.42 floor stops the wear reading as satin.
 */
export declare function denimRoughnessNode(u: DenimUniforms): Float;
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
export declare function createDenimMaterial(options: DenimMaterialOptions): DenimMaterial;
export {};
