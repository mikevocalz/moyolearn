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

/** What erasing one session did, as the guardian's screen needs to hear it. */
export interface ErasedTranscript {
  /**
   * False when the id named no session of this learner's. Not an error, for the
   * same reason `ErasedLine.erased` is not: a double-press has got what it asked
   * for, and reporting a failure would make S27 restore a session that is
   * correctly gone.
   */
  readonly erased: boolean;
  /**
   * The beliefs that went with it — the ones this session was the SOLE source
   * of. `cascadePreview` shows this count in the confirmation dialog before the
   * guardian presses, and the two come from the same function, so what the
   * dialog promised and what the server did cannot disagree.
   */
  readonly erasedFactIds: readonly string[];
  /**
   * Beliefs that lost this session from their provenance and kept another. They
   * survive with a shorter history rather than being deleted, because
   * `erasure.ts` defines the cascade on provenance: a fact several sessions
   * support is not the erased session's to take.
   */
  readonly trimmedFactIds: readonly string[];
}

/**
 * The repository port: cascade and delete, atomically.
 *
 * ONE PORT, like `EraseFactAndBlockTag`, and for the same reason — the read that
 * decides the cascade and the writes that apply it are one operation. A
 * `loadFactsFor`/`deleteFacts`/`deleteTranscript` trio would be a seam a caller
 * can use two thirds of, and it would put the decision outside the transaction
 * where a concurrent distillation can invalidate it.
 */
export type EraseTranscriptCascade = (
  ctx: ProtectedCtx,
  transcriptId: string,
) => Promise<ErasedTranscript>;

/**
 * What became of the child's uploaded files.
 *
 * A DISCRIMINATED UNION, because "nothing to delete" and "we could not tell
 * which files were hers" are opposite facts and a count of zero spells them the
 * same way. The second has to reach the guardian's screen intact — see
 * `presign.rules.ts:learnerMediaScope` for when it happens and why it is a
 * refusal rather than a best-effort prefix delete.
 */
export type ErasedMedia =
  | { readonly scoped: true; readonly deleted: number; readonly failed: readonly string[] }
  | { readonly scoped: false; readonly reason: string };

/** Repository port — deletes every object this learner uploaded, or refuses. */
export type EraseLearnerMedia = (ctx: ProtectedCtx) => Promise<ErasedMedia>;

/** Everything forgetting everything did, per store. */
export interface ForgottenRecord {
  readonly transcripts: number;
  readonly facts: number;
  /**
   * Blocked tags CLEARED, not recorded. Erasing one line writes a block; erasing
   * everything removes them — `edu.repository.ts:forgetEduLearnerRecord` argues
   * it at length. Counted rather than assumed so the number is visible if the
   * decision is ever revisited.
   */
  readonly blockedTags: number;
  readonly media: ErasedMedia;
}

/** Repository port — empties every `edu` table for the learner, in one transaction. */
export type ForgetLearnerRecord = (
  ctx: ProtectedCtx,
) => Promise<Omit<ForgottenRecord, 'media'>>;

/**
 * Erases one session and everything derived only from it, inside the protected
 * boundary.
 *
 * The transcript id is the only thing a caller may name, and it is scoped by
 * `ctx.learnerId` in the repository's own predicates — so the worst a hostile id
 * can do is name somebody else's session and delete nothing.
 *
 * Free `practise` floor, like `eraseMemoryLine` and for the reason stated there:
 * a lapsed card must never stand between a family and deleting a record of their
 * child.
 */
export async function eraseMemoryTranscript(
  auth: Auth,
  headers: Headers,
  transcriptId: string,
  eraseTranscriptCascade: EraseTranscriptCascade,
): Promise<ErasedTranscript> {
  return protectedOperation(auth, headers, (ctx) => eraseTranscriptCascade(ctx, transcriptId), {
    telemetry: { op: 'memory.eraseTranscript', resource: 'knowledgeGraph', action: 'delete' },
  });
}

/** The two stores "forget everything" has to reach. */
export interface ForgetEverythingPorts {
  readonly forgetLearnerRecord: ForgetLearnerRecord;
  readonly eraseLearnerMedia: EraseLearnerMedia;
}

/**
 * Forgets everything the product knows about the acting learner.
 *
 * NO ARGUMENT BUT THE PORTS. There is nothing for a caller to name: the learner
 * is `ctx.learnerId`, and an endpoint that accepted whose record to destroy is
 * the worst-shaped request in a children's product. `apps/web/app/api/memory/
 * forget-all/route.ts` therefore never reads its body at all.
 *
 * BOTH PORTS OR IT IS NOT "EVERYTHING". The rows are half of what we hold; the
 * other half is the photograph of a child's homework and the recording of her
 * voice. Grouped into one argument for the reason `DistillationPorts` is
 * grouped: two optional parameters is how one of them ends up never passed, and
 * this codebase has already paid for that mistake once.
 *
 * THE RECORD GOES FIRST, and a media failure does not undo it. Bunny being
 * unreachable must not leave a child's transcripts in the database — the
 * educational store is the half we can delete transactionally and the half the
 * tutor actually reads. The media outcome is REPORTED rather than thrown, and
 * `memory.store.ts` puts a sentence on the screen when it is anything other than
 * a clean sweep, because the failure this whole feature exists to prevent is a
 * guardian being told something is gone when it is not.
 *
 * Free `practise` floor, for the third time and the same reason.
 */
export async function forgetEverything(
  auth: Auth,
  headers: Headers,
  ports: ForgetEverythingPorts,
): Promise<ForgottenRecord> {
  return protectedOperation(
    auth,
    headers,
    async (ctx) => {
      const record = await ports.forgetLearnerRecord(ctx);
      const media = await ports.eraseLearnerMedia(ctx);
      return { ...record, media };
    },
    { telemetry: { op: 'memory.forgetEverything', resource: 'knowledgeGraph', action: 'delete' } },
  );
}
