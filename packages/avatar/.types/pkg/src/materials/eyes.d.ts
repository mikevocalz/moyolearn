/**
 * The eyes — doc 22 §4 row 3, and the trickiest translation in the port.
 *
 * An eye is not a painted sphere. The iris sits behind a refracting cornea, so
 * it PARALLAXES: look at someone from the side and their pupil appears shifted
 * relative to where the geometry puts it. The reference solved this without
 * per-eye uniforms, which is the clever part and the part worth preserving:
 *
 *   1. Refract the view ray at the cornea (IOR 1.376, the real one).
 *   2. March it `ACD` = 2.5 mm — anterior chamber depth — to the iris plane.
 *   3. Convert that model-space offset into the baked iris-plane UV using a
 *      SCREEN-SPACE COTANGENT FRAME built from `dFdx`/`dFdy` of both the
 *      position and the baked UV.
 *
 * Step 3 is why there are no per-eye uniforms: the frame is derived from the
 * surface itself, so the left and right eye each get their own correct basis
 * for free. It is also the step that made this row risky — `dFdx`/`dFdy` and
 * `refract` all had to exist in TSL, and they do (`three/tsl`, r185).
 *
 * The GLSL is ported line for line from the reference's `src/eyes.ts` rather
 * than from a description of it: every constant here (0.0025, 1/1.376, the two
 * iris browns, the 0.88→1.0 limbal ring, the 1.0→1.18 limbus blur, the
 * 0.0004→0.0013 meniscus band) is the reference's, unchanged. A look is only
 * reproducible if its numbers are.
 *
 * WHAT THE `<sc-if>`-STYLE EARLY RETURN BECAME: the GLSL bailed out of
 * `eyeParallaxUV()` with `if (abs(det) < 1e-12) return vEyeAux.xy;`. TSL builds
 * a graph rather than executing statements, so the guard is a `select()` — both
 * branches are computed and one is chosen, which is what the GPU does anyway.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §4 row 3
 * SOT-KEYWORDS: eyes iris sclera pupil parallax refract cornea cotangent dfdx meniscus limbus tsl
 */
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import { Matrix4, Vector3 } from 'three';
/** Baked per-vertex: (irisU, irisV, lidDistance, lidAO). Float32, vec4. */
export declare const EYE_AUX_ATTRIBUTE = "aEyeAux";
export interface EyeAuxMeta {
    irisRadius: number;
    pupilRadius: number;
}
/**
 * Shared across all three eye materials, exactly as the reference shared one
 * uniforms object: the camera position must be expressed in MODEL space, and
 * it is written once per frame by the caller (the reference did it from
 * `headMesh.onBeforeRender`).
 */
export declare function createEyeUniforms(aux: EyeAuxMeta): {
    cameraModel: import("three/webgpu").UniformNode<"vec3", Vector3>;
    irisRadius: import("three/webgpu").UniformNode<"float", number>;
    pupilRadius: import("three/webgpu").UniformNode<"float", number>;
};
export type EyeUniforms = ReturnType<typeof createEyeUniforms>;
export type EyeSurface = 'sclera' | 'iris' | 'pupil';
/**
 * Material order matters: these are three groups of ONE mesh, and the reference
 * reorders the geometry's material groups to match. Keep this order.
 */
export declare const EYE_SURFACES: readonly EyeSurface[];
export interface EyeMaterials {
    sclera: MeshPhysicalNodeMaterial;
    iris: MeshPhysicalNodeMaterial;
    pupil: MeshPhysicalNodeMaterial;
    uniforms: EyeUniforms;
    /**
     * Writes the model-space camera position. Call once per frame, before render
     * — the reference did it from `headMesh.onBeforeRender`.
     */
    update(cameraWorldPosition: Vector3, meshWorldMatrixInverse: Matrix4): void;
    ordered(): MeshPhysicalNodeMaterial[];
    dispose(): void;
}
export declare function makeEyeMaterials(aux: EyeAuxMeta): EyeMaterials;
