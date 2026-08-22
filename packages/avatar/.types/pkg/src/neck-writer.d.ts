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
/** Claims sole ownership of the neck/head bones. Invalidates prior claims. */
export declare function claimNeckWriter(): symbol;
/**
 * Marks the one permitted neck/head write for `frameId`. Throws in dev if
 * `token` is not the current owner or the frame was already written.
 */
export declare function claimNeckFrame(frameId: number, token: symbol): void;
/** Test-only: clears writer + frame state between cases. */
export declare function resetNeckWriterForTests(): void;
