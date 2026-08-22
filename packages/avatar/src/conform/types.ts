/**
 * The shapes the conform binary parses into.
 *
 * These live inside the conform project rather than beside the parser for a
 * structural reason: `driver.ts` is a composite project with its own tsconfig,
 * and a composite project cannot reach outside its own rootDir. Putting the
 * types here lets the strict parser next door import them across the
 * declaration boundary, instead of the boundary being weakened to accommodate
 * one type import.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §2
 * SOT-KEYWORDS: skirt conform types anchors pins barycentric feather meta
 */

export interface SkirtConformMeta {
  formatVersion: number;
  identitySha256: string;
  boneNamesSha256: string;
  inverseBindSha256: string;
}

/** Pose-aware attachment data baked from the canonical full SMPL-X surface. */
export interface SkirtConformData {
  anchorCount: number;
  pinCount: number;
  sourceVertex: Uint32Array;
  anchorPosition: Float32Array;
  anchorNormal: Float32Array;
  anchorJoint: Uint8Array;
  anchorWeight: Float32Array;
  vertexIndex: Uint32Array;
  feather: Float32Array;
  pinAnchor: Uint32Array;
  barycentric: Float32Array;
  normalOffset: Float32Array;
}
