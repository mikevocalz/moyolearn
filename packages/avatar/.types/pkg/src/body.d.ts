/**
 * Moyo header block: loads the SMPL-X body and asserts its rig against the
 * shipped manifest. The manifest IS the contract — bone order equals glTF
 * skin.joints order equals three.js Skeleton.bones order — and every baked
 * artifact downstream (the conform, the neck align) was baked against that
 * exact order. So this file is paranoid on purpose: a name-by-name bone check
 * and a skin-weight sum check at load, because both failures render as a
 * plausible-looking body rather than as an error.
 *
 * `frustumCulled = false` is load-bearing, not tidying: three culls a
 * SkinnedMesh against its BIND-pose bounding box, so a posed body vanishes at
 * the edge of frame. The RN WebGPU examples hit this and do the same thing.
 *
 * Ported from the gnm-avatar reference renderer; the only change is that the
 * asset URLs are required parameters rather than same-origin defaults.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §2, §4 row 17
 * SOT-KEYWORDS: smplx body gltf skinned mesh manifest bones skeleton rig contract frustum
 */
import * as THREE from 'three';
export interface BodyManifest {
    space: string;
    source: string;
    units: string;
    bones: string[];
    parents: Record<string, string | null>;
    heads: Record<string, [number, number, number]>;
}
export interface Body {
    root: THREE.Group;
    mesh: THREE.SkinnedMesh;
    manifest: BodyManifest;
    /** axisAngle: Float32Array of manifest.bones.length * 3, manifest order. */
    setPose: (axisAngle: Float32Array) => void;
}
/**
 * URLs are REQUIRED, deliberately. The reference defaulted them to `/body/...`,
 * a same-origin web assumption. Here every avatar artifact comes from the CDN
 * through the capability manager (doc 22 §3), so the caller resolves them and
 * this module never guesses.
 */
export declare function loadBody(glbUrl: string, manifestUrl: string): Promise<Body>;
