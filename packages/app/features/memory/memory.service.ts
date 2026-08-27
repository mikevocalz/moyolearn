// S27's eraser, on the server — the half that outlives the tab.
//
// `memory.store.ts` erased a line out of a zustand array and nothing else. The
// row vanished from the guardian's screen, the database never heard about it,
// and a reload put it back. Doc 07 §S27 promises "every line is literally
// erasable, and the eraser works"; this is where that stops being a claim about
// a React re-render.
//
// AN ERASURE IS TWO WRITES AND ONE DECISION. Deleting the fact is the obvious
// half. Recording that its tag must not be derived again is the half that makes
// the first one true — `packages/student-model/src/erasure.ts` says it plainly:
// "Deleting a fact that the next session would re-derive is theatre." The two
// belong to one another, so they are one port and the repository behind it does
// them in one transaction. A design where the service issued them as two calls
// is a design where a crash between them leaves a guardian who deleted a line
// watching it come back next week.
//
// WHAT THE CALLER MAY NAME. A fact id, and nothing else. The learner is
// `ctx.learnerId` (CLAUDE.md §The block), the tag is read off the row that was
// actually deleted rather than accepted from the client, and the delete is
// scoped by both — so the worst a hostile id can do is name a fact belonging to
// somebody else and delete nothing.
// SOT: docs/pack/07-security-child-ai-safety-spec.md §4 §S27 · packages/student-model/src/erasure.ts
// SOT-KEYWORDS: memory s27 erase service server-only protected operation blocked tag guardian delete knowledge graph re-derivation
import 'server-only';
import type { Auth } from '@acme/auth/server';
import { protectedOperation, type ProtectedCtx } from '../../core/protected-operation';

/** What one erasure did, as the guardian's screen needs to hear it. */
export interface ErasedLine {
  /**
   * False when the id named no row of this learner's. Not an error: a guardian
   * pressing the same button twice, or a retry of a request that already
   * succeeded, has got what it asked for. The screen must not report a failure
   * for a line that is correctly gone.
   */
  readonly erased: boolean;
  /**
   * The tag now blocked from re-derivation, or null when the erased fact had
   * none. Mastery, review and scaffolding are records of work the child did and
   * `erasure.ts` refuses to make them blockable, so erasing one deletes a row
   * and blocks nothing — which is the correct answer, not a missing feature.
   */
  readonly blockedTag: string | null;
}

/**
 * The repository port: delete the fact and record its tag, atomically.
 *
 * ONE PORT AND NOT TWO, because the two writes have no meaning apart. A
 * `deleteFact` port beside a `blockTag` port would be a seam a caller can use
 * half of — and this codebase has already paid for exactly that mistake once,
 * in `tutor.service.ts`, where a `LoadBlockedTags` port sat declared and unwired
 * for as long as it took a guardian to notice erasure was reversible.
 */
export type EraseFactAndBlockTag = (ctx: ProtectedCtx, factId: string) => Promise<ErasedLine>;

/**
 * Erases one line of the student model inside the protected boundary.
 *
 * NO `requires`, so the capability defaults to `practise` — the free floor that
 * `protected-operation.ts` documents as true on every subscription status
 * including none at all. That is deliberate and it is the only defensible
 * setting: a family whose card lapsed must still be able to delete what we know
 * about their child. Gating erasure behind a plan would make the retention
 * promise conditional on payment, which is the shape of a dark pattern doc 07
 * exists to forbid.
 */
export async function eraseMemoryLine(
  auth: Auth,
  headers: Headers,
  factId: string,
  eraseFactAndBlockTag: EraseFactAndBlockTag,
): Promise<ErasedLine> {
  return protectedOperation(auth, headers, (ctx) => eraseFactAndBlockTag(ctx, factId), {
    telemetry: { op: 'memory.eraseLine', resource: 'knowledgeGraph', action: 'delete' },
  });
}
