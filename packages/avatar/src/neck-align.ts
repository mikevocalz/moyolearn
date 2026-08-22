/**
 * Loader for the baked GNM-model -> SMPL-X-head-bone-local transform. This one
 * matrix is what puts the head on the neck; a silently wrong one is a head
 * floating in front of a body, so the loader is paranoid by design — exact
 * space strings, 16 finite numbers, and a provenance hash that must match.
 *
 * WHAT CHANGED IN THE PORT, and why it is better rather than merely different:
 *
 * The reference recomputed a sha-256 over the float32 bytes of the
 * `identity.json` it had just loaded, and compared that to the hash baked into
 * this document. That needed `crypto.subtle`, which Hermes does not have.
 *
 * It is also no longer the right question. After the runtime rebake (doc 22
 * §6.3) the identity is FOLDED INTO the head container — there is no identity
 * vector at runtime to hash. The container instead carries the hash it was
 * baked from, at `meta.bake.identitySha256`. So the check becomes a string
 * comparison between two baked artifacts, and it asserts something stronger
 * than the original: not "this transform matches the identity I happened to
 * load", but "this transform was baked for the identity actually folded into
 * this head". No crypto, no polyfill, no async.
 *
 * The capability manager caches the head container and this transform
 * independently, so a mismatched pair is a reachable state, not a theoretical
 * one — which is the whole reason the hash is here.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §2, §6.3
 * SOT-KEYWORDS: neck align transform head bone matrix provenance identity hash baked seam
 */

export interface NeckAlign {
  /** 16 floats, column-major (THREE.Matrix4.fromArray order). */
  matrix: number[];
  space: { from: string; to: string };
  identitySha256: string;
  provenance?: unknown;
}

export const NECK_ALIGN_FROM = 'gnm-model';
export const NECK_ALIGN_TO = 'smplx-headbone-local(gltf-y-up)';

/**
 * Pure validation. `identitySha256` is the hash the HEAD CONTAINER was baked
 * from — read it off `meta.bake.identitySha256`, not from an identity vector.
 */
export function assertNeckAlign(doc: NeckAlign, identitySha256: string): void {
  if (doc.space?.from !== NECK_ALIGN_FROM || doc.space?.to !== NECK_ALIGN_TO) {
    throw new Error(
      `neck-align space mismatch: got ${JSON.stringify(doc.space)}, ` +
        `expected {from: "${NECK_ALIGN_FROM}", to: "${NECK_ALIGN_TO}"}`
    );
  }
  if (
    !Array.isArray(doc.matrix) ||
    doc.matrix.length !== 16 ||
    !doc.matrix.every((v) => typeof v === 'number' && Number.isFinite(v))
  ) {
    throw new Error('neck-align matrix must be 16 finite numbers');
  }
  if (doc.identitySha256 !== identitySha256) {
    throw new Error(
      'neck-align identity hash mismatch: transform was baked for ' +
        `${doc.identitySha256}, head container was baked from ${identitySha256} ` +
        '— the cached artifacts are from different bakes; rerun ' +
        'tools/bake_neck_align.py or clear the avatar asset cache'
    );
  }
}

/**
 * `url` is required — every avatar artifact is resolved by the capability
 * manager, never guessed from a same-origin path (doc 22 §3).
 */
export async function loadNeckAlign(
  url: string,
  identitySha256: string
): Promise<NeckAlign> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`neck-align fetch failed: ${response.status}`);
  }
  const doc = (await response.json()) as NeckAlign;
  assertNeckAlign(doc, identitySha256);
  return doc;
}
