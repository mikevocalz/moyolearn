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
import {
  BRDF_GGX,
  attribute,
  normalView,
  positionViewDirection,
  specularColor,
  specularF90,
  uniform,
} from 'three/tsl';
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

export const SKIN_DEFAULTS: Readonly<SkinParams> = Object.freeze({
  // Milk-chocolate complexion pass: the terminator warms into red-brown rather
  // than desaturating toward grey.
  scatterColor: new Color(0.62, 0.18, 0.11),
  scatterStrength: 0.55,
  backColor: new Color(0.72, 0.22, 0.16),
  backStrength: 0.35,
  backPower: 3.2,
  backDistortion: 0.28,
  lobe2Roughness: 0.62,
  lobe2Strength: 0.22,
  vellusColor: new Color(0.42, 0.3, 0.26),
  vellusStrength: 0.16,
});

/**
 * Per-vertex aux baked by `tools/bake_skin_aux.py`.
 *
 * BOTH MUST BE `Float32Array`. three r185 cannot bind an `itemSize === 1`
 * attribute backed by an 8-bit array — `WebGPUAttributeUtils` has no entry for
 * it and throws "Vertex format not supported yet". Packing these to int8 to
 * save 100 KB is the obvious optimisation and it does not work (doc 22 §4 row 2).
 */
export const SKIN_CURVATURE_ATTRIBUTE = 'aCurvature';
export const SKIN_THICKNESS_ATTRIBUTE = 'aThickness';

/**
 * `@types/three` declares the `LightingModelDirectInput` fields and
 * `attribute()`'s result as bare `Node`, which carries no math operators — the
 * operators live on the typed `Node<'vec3'>` / `Node<'float'>` forms. That is
 * an upstream gap, not a signal that the values are the wrong shape: the
 * runtime hands `direct()` a vec3 light direction, a vec3 light colour and vec3
 * accumulators, exactly as `PhysicalLightingModel` itself uses them.
 *
 * So the narrowing happens ONCE, here, where it can be explained — rather than
 * as a scatter of inline casts through the maths, where it would read as
 * uncertainty about the values instead of about the declarations.
 */
type Vec3 = Node<'vec3'>;
type Float = Node<'float'>;

const asVec3 = (node: Node): Vec3 => node as unknown as Vec3;
const asFloat = (node: unknown): Float => node as Float;

/**
 * Inferred from the factory rather than hand-declared: `uniform()` is an
 * overload set that narrows on the argument (`Color` -> `UniformNode<'color'>`,
 * number -> `UniformNode<'float'>`), and writing the field types by hand
 * collapses every one of them to `UniformNode<unknown, unknown>` — which then
 * fails to satisfy the node-math operators with an error that points at the
 * call site rather than the declaration. Let the overloads do their job.
 */
export type SkinUniforms = ReturnType<typeof createSkinUniforms>;

export function createSkinUniforms(params: SkinParams = SKIN_DEFAULTS) {
  return {
    scatterColor: uniform(params.scatterColor),
    scatterStrength: uniform(params.scatterStrength),
    backColor: uniform(params.backColor),
    backStrength: uniform(params.backStrength),
    backPower: uniform(params.backPower),
    backDistortion: uniform(params.backDistortion),
    lobe2Roughness: uniform(params.lobe2Roughness),
    lobe2Strength: uniform(params.lobe2Strength),
    vellusColor: uniform(params.vellusColor),
    vellusStrength: uniform(params.vellusStrength),
  };
}

/**
 * The vellus rim — fine facial hair catching light at grazing angles. Additive
 * after lighting, which is what `emissiveNode` is: `NodeMaterial` adds it to
 * outgoing light once everything else has resolved.
 */
export function skinEmissiveNode(u: SkinUniforms) {
  const fresnel = positionViewDirection.dot(normalView).clamp().oneMinus().pow(4);
  return u.vellusColor.mul(fresnel).mul(u.vellusStrength);
}

/**
 * Adds the three skin terms to the stock physical response, per light.
 *
 * `direct()` is emitted ONCE PER LIGHT at build time, so the light count is
 * baked into the compiled shader — adding or removing a light triggers a
 * rebuild. That matches WebGL's unrolled loop, so behaviour is unchanged, but
 * it does mean per-light behaviour cannot be made data-driven at runtime.
 */
export class SkinLightingModel extends PhysicalLightingModel {
  private readonly u: SkinUniforms;
  private readonly curvature = asFloat(attribute(SKIN_CURVATURE_ATTRIBUTE, 'float'));
  private readonly thickness = asFloat(attribute(SKIN_THICKNESS_ATTRIBUTE, 'float'));

  constructor(u: SkinUniforms) {
    // No clearcoat, sheen, iridescence, anisotropy, transmission or dispersion:
    // skin needs none of them, and each flag costs shader.
    super(false, false, false, false, false, false);
    this.u = u;
  }

  override direct(lightData: LightingModelDirectInput, builder: NodeBuilder): void {
    // The stock Lambert diffuse + primary GGX lobe first; everything below adds.
    super.direct(lightData, builder);

    const lightDirection = asVec3(lightData.lightDirection);
    const lightColor = asVec3(lightData.lightColor);
    const directDiffuse = asVec3(lightData.reflectedLight.directDiffuse);
    const directSpecular = asVec3(lightData.reflectedLight.directSpecular);
    const u = this.u;

    // --- 1. wrapped scattering at the terminator ---------------------------
    // wrap = saturate((N·L + 0.5) / 1.5) shifts the falloff past the geometric
    // terminator; multiplying by (1 - saturate(N·L)) confines the added warmth
    // to the terminator band instead of tinting the whole lit side.
    const nDotL = normalView.dot(lightDirection);
    const wrap = nDotL.add(0.5).div(1.5).clamp();
    const terminator = wrap.mul(nDotL.clamp().oneMinus());
    const curvatureScale = this.curvature.mul(0.65).add(0.35);
    directDiffuse.addAssign(
      lightColor.mul(u.scatterColor).mul(u.scatterStrength).mul(terminator).mul(curvatureScale)
    );

    // --- 2. thickness backscatter ------------------------------------------
    // Light bent through the surface and viewed from the far side. `thickness`
    // is inverted because the bake stores thickness, and transmission is what
    // happens where there is LESS of it.
    const backDirection = lightDirection.negate().add(normalView.mul(u.backDistortion)).normalize();
    const back = positionViewDirection.dot(backDirection.negate()).clamp().pow(u.backPower);
    directDiffuse.addAssign(
      lightColor.mul(u.backColor).mul(u.backStrength).mul(back).mul(this.thickness.oneMinus())
    );

    // --- 3. the second, broader specular lobe -------------------------------
    const irradiance = nDotL.clamp().mul(lightColor);
    // `BRDF_GGX` is declared as returning `OperatorNode`, which carries no type
    // tag, so the operators cannot resolve an overload against it — the same
    // upstream gap as the light data above, narrowed the same way.
    const broadLobe = asVec3(
      BRDF_GGX({
        lightDirection,
        f0: specularColor,
        f90: specularF90,
        roughness: u.lobe2Roughness,
      }) as unknown as Node
    );
    directSpecular.addAssign(irradiance.mul(broadLobe).mul(u.lobe2Strength));
  }
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
export class SkinNodeMaterial extends MeshPhysicalNodeMaterial {
  readonly skin: SkinUniforms;

  constructor(options: SkinMaterialOptions = {}) {
    super({
      color: options.color ?? new Color(0x7d4f35),
      roughness: options.roughness ?? 0.48,
      metalness: 0,
    });
    this.skin = createSkinUniforms(options.params ?? SKIN_DEFAULTS);
    this.emissiveNode = skinEmissiveNode(this.skin);
  }

  // The base declares `() => PhysicalLightingModel`, and SkinLightingModel is
  // one — widening the return type to `LightingModel` breaks the override.
  override setupLightingModel(): PhysicalLightingModel {
    return new SkinLightingModel(this.skin);
  }
}
