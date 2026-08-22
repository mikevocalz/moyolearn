/**
 * Moyo header block: the neck/head single-writer guard. Two systems can
 * plausibly rotate the head — the body rig and the GNM head — and when both do,
 * the seam tears in a way that is almost impossible to debug from a screenshot.
 * This makes the rule mechanical: the body layer owns neck/head, claims the
 * token once, and presents it exactly once per frame.
 *
 * Ported verbatim from the gnm-avatar reference renderer (`src/neck-writer.ts`).
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §2
 * SOT-KEYWORDS: neck head single-writer token guard body-owned frame seam
 */

/**
 * Neck/head single-writer guard (§8, §14.2). The BODY layer owns head and
 * neck rotation; the GNM head contributes expression only. This extends the
 * face-bus writer-token pattern (claimFaceWriter in store.ts): the body rig
 * claims THE token once at construction, and must present it exactly once
 * per frame before touching neck/head/spine/pelvis bones. In dev, a stale
 * token (someone else claimed since) or a second write in the same frame
 * throws. Dependency-free so it unit-tests headless.
 */
let writer: symbol | null = null;
let lastFrameId: number | null = null;

/** Claims sole ownership of the neck/head bones. Invalidates prior claims. */
export function claimNeckWriter(): symbol {
  writer = Symbol('neck-writer');
  return writer;
}

/**
 * Marks the one permitted neck/head write for `frameId`. Throws in dev if
 * `token` is not the current owner or the frame was already written.
 */
export function claimNeckFrame(frameId: number, token: symbol): void {
  if (process.env.NODE_ENV !== 'production') {
    if (token !== writer) {
      throw new Error(
        'neck/head bones written by a non-owner: the body layer holds the ' +
          'single neck writer token (§8)'
      );
    }
    if (lastFrameId === frameId) {
      throw new Error(`neck/head bones written twice in frame ${frameId} (§8)`);
    }
  }
  lastFrameId = frameId;
}

/** Test-only: clears writer + frame state between cases. */
export function resetNeckWriterForTests(): void {
  writer = null;
  lastFrameId = null;
}
