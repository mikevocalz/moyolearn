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
import { Color, Vector2 } from 'three';
/** Normalised distance along a braid: 0 at the root, 1 at the tip. */
export declare const HAIR_T_ATTRIBUTE = "aHairT";
/** Per-strand phase offset, so no two braids move together. */
export declare const HAIR_PHASE_ATTRIBUTE = "aHairPhase";
type Vec3 = Node<'vec3'>;
export type HairDebugMode = 'none' | 'flow' | 'motion' | 'roots';
export declare function createHairUniforms(): {
    time: import("three/webgpu").UniformNode<"float", number>;
    /** Maximum sway at a free tip, in metres: (x, z). */
    sway: import("three/webgpu").UniformNode<"vec2", Vector2>;
    debug: import("three/webgpu").UniformNode<"float", number>;
};
export type HairUniforms = ReturnType<typeof createHairUniforms>;
/**
 * The sway offset. Roots are pinned by construction: `smoothstep(0.08, 1)`
 * squared means the first 8% of every braid contributes nothing and the falloff
 * is quadratic, so a braid bends rather than pivoting at the scalp.
 *
 * Two incommensurate sine terms per axis — 1.27/0.71 on x, 0.93 on z — so the
 * motion never visibly repeats.
 */
export declare function hairSwayNode(u: HairUniforms): Vec3;
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
export declare function createHairMaterial(options?: HairMaterialOptions): HairMaterial;
export {};
