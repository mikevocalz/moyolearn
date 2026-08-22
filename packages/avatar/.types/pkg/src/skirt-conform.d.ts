/**
 * Moyo header block: the head/body seam driver. The GNM head is a separate mesh
 * from the SMPL-X body, and where they meet the head's lower boundary must be
 * pulled onto the live, skinned body surface every frame or the neck shows a
 * staircase. This reproduces three's linear blend skinning on the CPU for 386
 * baked anchors, resolves 2,092 barycentric pins into head-group-local space,
 * and feathers both positions and normals across the join.
 *
 * Ported verbatim from the gnm-avatar reference renderer, with ONE change:
 * `crypto.subtle` does not exist in Hermes, so the rig-provenance hashes go
 * through `./crypto/sha256.ts`. That also makes `validateSkirtConformRig`
 * synchronous, which it always wanted to be.
 *
 * Those hashes are not ceremony. The conform data is valid only for the exact
 * bone order and inverse-bind matrices it was baked against, and the capability
 * manager caches the conform and the body glb independently — so a mismatched
 * pair is a reachable state that renders as a subtly wrong neck rather than as
 * an error.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §2
 * SOT-KEYWORDS: skirt conform parse validate scf4 binary provenance hash anchors pins
 */
import * as THREE from 'three';
import type { SkirtConformData, SkirtConformMeta } from './conform/types.ts';
/** Parses the versioned skirt-conform binary and rejects stale v3 assets. */
export declare function parseSkirtConform(buffer: ArrayBuffer): SkirtConformData;
/** Ensures the copied full-body anchors match the loaded headless rig. */
export declare function validateSkirtConformRig(meta: SkirtConformMeta, mesh: THREE.SkinnedMesh, orderedBoneNames: readonly string[]): void;
