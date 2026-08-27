// Distillation, off the learner's request path — doc 12 §5's "async after
// close", finally asynchronous.
//
// `packages/app/features/tutor/tutor.service.ts:evaluateTutorTurn` distilled the
// student model INLINE, inside the child's turn, and wrote the facts back before
// responding. `docs/design/jobs.md` §2.1 named that as the single
// highest-value queue on the page: "it spends the learner's latency budget on
// work the learner is not waiting for." This function is that work, moved.
//
// WHERE IDENTITY COMES FROM, since this is the one place in the codebase where
// it does not come from a session. CLAUDE.md forbids identity as a parameter —
// "never from client input, never from an AI tool argument". A job has no
// session by construction: the child whose turn it was may have closed the app
// an hour ago. So the learner id is read off `edu.transcripts.learner_id`, which
// is a durable row the Block wrote inside a protected operation, and the job
// payload carries only the transcript id (`docs/design/jobs.md` §4.1). A caller
// who wanted to distil somebody else's model would have to name a transcript
// that is already theirs — the id is not an identity claim, it is a pointer to
// one that was already checked.
// SOT: packages/student-model/src/distill.ts · docs/design/jobs.md §2.1 §3 · docs/pack/12-systems-design-prompt.md §5
// SOT-KEYWORDS: distill service job handler student model facts async after close transcript learner identity from row idempotent
import 'server-only';
import { distill } from '@acme/student-model';
import type { ProtectedCtx } from '@acme/app/server';
import { loadEduPriorFacts, saveEduFacts } from './edu.repository';
import { loadTranscriptForDistillation } from './distill.repository';

export interface DistillationResult {
  /** False when the transcript was already swept. Success, not a failure. */
  readonly found: boolean;
  readonly facts: number;
}

/**
 * Re-derives the student model from one transcript and writes it back.
 *
 * IDEMPOTENT BY THE NATURAL KEY, which is what `docs/design/jobs.md` §3 requires
 * behind the `singletonKey`: `distill.ts:factId` is `${learnerId}:${kind}:${subject}`
 * and `saveEduFacts` upserts on it, so running this twice over the same
 * transcript recomputes the same rows rather than appending a second set. That
 * is the property that makes a retry safe and a dead-letter replay safe.
 *
 * It re-reads the prior facts on every run rather than taking them as an
 * argument, for the same reason: a payload carrying the prior model would be a
 * copy of a child's record sitting in `jobs.job`, and it would be stale by the
 * time a retry ran.
 */
export async function distillTranscript(transcriptId: string): Promise<DistillationResult> {
  const transcript = await loadTranscriptForDistillation(transcriptId);
  if (transcript === null) return { found: false, facts: 0 };

  /*
    The context this job acts in, built from the row rather than from a session.

    `isLearner` is true because `edu.transcripts` holds nothing else — a
    transcript is a record of a child's turns, and the collection has no other
    author. `orgId` is absent because distillation is scoped to one learner's
    own model and reads nothing tenant-scoped; supplying one would be inventing a
    tenancy claim the row does not carry.
  */
  const ctx: ProtectedCtx = { learnerId: transcript.learnerId, isLearner: true };

  const priorFacts = await loadEduPriorFacts(ctx);
  /*
    `new Date()` and not the transcript's `capturedAt`.

    Distillation's clock decides mastery decay and review scheduling
    (`mastery.ts:decayMastery`, `review.ts:scheduleReview`). Using the capture
    time would make a job that ran a day late schedule a review for yesterday,
    and a dead-letter replay a month later schedule one for last month. The turns
    are historical; the derived schedule is not.
  */
  const facts = distill(transcript, priorFacts, new Date());
  await saveEduFacts(ctx, facts);

  return { found: true, facts: facts.length };
}
