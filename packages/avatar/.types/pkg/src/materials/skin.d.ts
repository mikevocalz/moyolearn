/**
 * Deep-skin shading, as a WebGPU lighting model.
 *
 * THIS IS DOC 22 §4 ROW 1 — the highest-risk row in the spec, and the reason
 * the port is a rewrite rather than a move. The reference achieved this by
 * string surgery on three's own GLSL: it patched `lights_physical_pars_fragment`
 * and `lights_fragment_begin`, and it mutated `THREE.ShaderChunk` at runtime.
 * None of that exists on the WebGPU path — `onBeforeCompile` is not a member of
 * `NodeMaterial` and `ShaderChunk` is exported only from the WebGL entry point.
 * The sanctioned hook is `NodeMaterial.setupLightingModel()`, returning a
 * `LightingModel` whose `direct()` runs once per light at BUILD time, emitting
 * straight-line code exactly as WebGL's unrolled `RE_Direct` loop did.
 *
 * WHAT THE THREE TERMS ARE FOR — this is a look, not a formula, and the look is
 * the point. On brown and caramel skin a stock GGX + Lambert response goes grey
 * at the terminator and reads plastic in the highlight; every term here exists
 * to fix one of those:
 *
 *   1. WRAPPED SCATTERING at the terminator. Light does not stop at N·L = 0 in
 *      skin; it wraps and comes back warm. Scaled by baked per-vertex curvature,
 *      because the effect is strongest where the surface bends.
 *   2. THICKNESS BACKSCATTER. Ears, nostril rims and lip edges are thin enough
 *      to transmit. Driven by baked thickness, so it appears where flesh is
 *      actually thin instead of everywhere.
 *   3. A SECOND, BROADER SPECULAR LOBE. Single-lobe skin reads like plastic;
 *      the oily sheen and the broad sub-surface sheen are two different widths.
 *
 * The vellus rim (a Fresnel term the reference added to `totalEmissiveRadiance`)
 * is NOT here: `emissiveNode` is added to outgoing light after all lighting
 * (NodeMaterial ~line 1109), which is exactly the right place, so it belongs on
 * the material rather than inside the lighting model. See `skinEmissiveNode`.
 *
 * PINNED TO three 0.185.1 (doc 22 §6). `PhysicalLightingModel.direct()` changes
 * in r186 — `BRDF_GGX_Multiscatter` becomes `BRDF_GGX` + multi-scatter
 * compensation, and a glTF fresnel-mix splits the diffuse — so this subclass's
 * `super.direct()` call WILL shift the look across that bump. That is a golden
 * re-approval, not a surprise.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §4 row 1, §4 row 2, §6
 * SOT-KEYWORDS: skin brdf sss scatter backscatter specular lobe lighting model tsl webgpu physical
 */
import { MeshPhysicalNodeMaterial, PhysicalLightingModel } from 'three/webgpu';
import type { LightingModelDirectInput, Node, NodeBuilder } from 'three/webgpu';
import { Color } from 'three';
/**
 * The tuned constants from the reference's GLSL, unchanged. They are uniforms
 * rather than literals so a look-dev pass can move them without a rebuild —
 * and because doc 22 §4 row 2 forbids the obvious alternative of packing them
 * into an `itemSize: 1` int8 attribute.
 */
export interface SkinParams {
    scatterColor: Color;
    scatterStrength: number;
    backColor: Color;
    backStrength: number;
    backPower: number;
    backDistortion: number;
    lobe2Roughness: number;
    lobe2Strength: number;
    vellusColor: Color;
    vellusStrength: number;
}
export declare const SKIN_DEFAULTS: Readonly<SkinParams>;
/**
 * Per-vertex aux baked by `tools/bake_skin_aux.py`.
 *
 * BOTH MUST BE `Float32Array`. three r185 cannot bind an `itemSize === 1`
 * attribute backed by an 8-bit array — `WebGPUAttributeUtils` has no entry for
 * it and throws "Vertex format not supported yet". Packing these to int8 to
 * save 100 KB is the obvious optimisation and it does not work (doc 22 §4 row 2).
 */
export declare const SKIN_CURVATURE_ATTRIBUTE = "aCurvature";
export declare const SKIN_THICKNESS_ATTRIBUTE = "aThickness";
/**
 * Inferred from the factory rather than hand-declared: `uniform()` is an
 * overload set that narrows on the argument (`Color` -> `UniformNode<'color'>`,
 * number -> `UniformNode<'float'>`), and writing the field types by hand
 * collapses every one of them to `UniformNode<unknown, unknown>` — which then
 * fails to satisfy the node-math operators with an error that points at the
 * call site rather than the declaration. Let the overloads do their job.
 */
export type SkinUniforms = ReturnType<typeof createSkinUniforms>;
export declare function createSkinUniforms(params?: SkinParams): {
    scatterColor: import("three/webgpu").UniformNode<"color", Color>;
    scatterStrength: import("three/webgpu").UniformNode<"float", number>;
    backColor: import("three/webgpu").UniformNode<"color", Color>;
    backStrength: import("three/webgpu").UniformNode<"float", number>;
    backPower: import("three/webgpu").UniformNode<"float", number>;
    backDistortion: import("three/webgpu").UniformNode<"float", number>;
    lobe2Roughness: import("three/webgpu").UniformNode<"float", number>;
    lobe2Strength: import("three/webgpu").UniformNode<"float", number>;
    vellusColor: import("three/webgpu").UniformNode<"color", Color>;
    vellusStrength: import("three/webgpu").UniformNode<"float", number>;
};
/**
 * The vellus rim — fine facial hair catching light at grazing angles. Additive
 * after lighting, which is what `emissiveNode` is: `NodeMaterial` adds it to
 * outgoing light once everything else has resolved.
 */
export declare function skinEmissiveNode(u: SkinUniforms): Node<"vec3">;
/**
 * Adds the three skin terms to the stock physical response, per light.
 *
 * `direct()` is emitted ONCE PER LIGHT at build time, so the light count is
 * baked into the compiled shader — adding or removing a light triggers a
 * rebuild. That matches WebGL's unrolled loop, so behaviour is unchanged, but
 * it does mean per-light behaviour cannot be made data-driven at runtime.
 */
export declare class SkinLightingModel extends PhysicalLightingModel {
    private readonly u;
    private readonly curvature;
    private readonly thickness;
    constructor(u: SkinUniforms);
    direct(lightData: LightingModelDirectInput, builder: NodeBuilder): void;
}
export interface SkinMaterialOptions {
    params?: SkinParams;
    color?: Color;
    roughness?: number;
}
/**
 * ONE material instance is shared by the GNM head mesh and the SMPL-X body,
 * exactly as in the reference — which means this shader compiles with
 * `USE_SKINNING` and must not assume it is unskinned. Nothing here touches
 * position, so that holds by construction.
 */
export declare class SkinNodeMaterial extends MeshPhysicalNodeMaterial {
    readonly skin: SkinUniforms;
    constructor(options?: SkinMaterialOptions);
    setupLightingModel(): PhysicalLightingModel;
}
