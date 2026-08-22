/**
 * Builds a small, valid `GNMW` container in memory.
 *
 * Why this exists: the reference renderer's head tests read the shipped
 * `public/gnm/gnm_head_web.bin` — 34.9 MB. Doc 22 §3 forbids that byte weight
 * from ever entering the app, and by extension it has no business in the repo
 * or in CI. A synthesised container is also the stronger test: it exercises the
 * parser's declared contract at chosen dimensions instead of one opaque blob
 * that happens to work.
 *
 * The real container remains testable — see the env-gated integration case in
 * `../gnm/model.test.ts`, which points at a locally cached copy.
 *
 * Layout mirrors `tools/export_gnm_web.py` as parsed by `parseContainer`:
 *   'GNMW' | u32 version=1 | u32 headerLength | header JSON | section bytes
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §2, §3, §8
 * SOT-KEYWORDS: gnm container fixture synthetic gnmw test parser header sections
 */
export interface FixtureDims {
    numVertices: number;
    numJoints: number;
    identityDim: number;
    expressionDim: number;
    numTriangles: number;
}
export declare const DEFAULT_FIXTURE_DIMS: FixtureDims;
/**
 * Returns a parseable GNMW buffer plus the dimensions it was built at.
 *
 * Joint 0 is the root (parent -1) and every other joint parents to the one
 * before it, so the FK chain is genuinely nested rather than a flat fan — a
 * flat hierarchy would let a broken parent walk pass.
 */
export declare function buildGnmFixture(dims?: FixtureDims, seed?: number): {
    buffer: ArrayBuffer;
    dims: FixtureDims;
};
