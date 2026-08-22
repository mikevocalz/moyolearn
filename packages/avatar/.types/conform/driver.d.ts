/**
 * The conform driver: the per-frame numeric half of the head/body seam.
 *
 * Reproduces three's linear blend skinning on the CPU for 386 baked anchors
 * (each skinned twice — once at the surface, once at a 1 cm normal probe),
 * resolves 2,092 barycentric attachments from body world into live head-group
 * local, and feathers the streamed GNM positions and normals onto the result.
 * This runs on every dirty frame, over typed arrays, and is the reason the neck
 * does not staircase when the head turns.
 *
 * THIS FILE IS ITS OWN TypeScript PROJECT (`./tsconfig.json`), for the same
 * reason `src/gnm/model.ts` is and under the same admission rule — see
 * ../../README.md. It was SPLIT OUT of `skirt-conform.ts` rather than exempting
 * that whole file: the parser and the rig validation kept only 3 index errors
 * between them and are worth checking strictly, while the driver had 82 and is
 * pure arithmetic over dimensions the parser already validated. Exempting the
 * file would have taken the parser's byte-length and weight-sum checks — the
 * ones most likely to catch a real bug — out of the flag's reach.
 *
 * Ported verbatim from the gnm-avatar reference renderer.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §2
 * SOT-KEYWORDS: skirt conform driver seam lbs anchors barycentric pins feather normals kernel
 */
import * as THREE from 'three';
import type { SkirtConformData } from './types.ts';
export interface SkirtConformDriver {
    /** Skins all canonical anchors and pins the streamed GNM positions. */
    pinPositions: (positions: Float32Array) => void;
    /** Blends freshly computed GNM normals toward the live body normals. */
    blendNormals: (normals: Float32Array) => void;
    /** Live world-space target access for deterministic seam validation. */
    getTargetWorld: (pin: number, out: THREE.Vector3) => THREE.Vector3;
    getTargetNormalWorld: (pin: number, out: THREE.Vector3) => THREE.Vector3;
}
/**
 * Reproduces Three's LBS for copied full-body vertices, then resolves each
 * barycentric surface attachment through body world into live head-group local.
 */
export declare function createSkirtConformDriver(data: SkirtConformData, bodyRoot: THREE.Object3D, mesh: THREE.SkinnedMesh, headGroup: THREE.Object3D): SkirtConformDriver;
