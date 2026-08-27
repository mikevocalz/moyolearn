// POST /api/tutor/evaluate — server-side answer check for the S9 tutor.
//
// THE COMPOSITION ROOT for the tutoring write path, which is why the store the
// turn lands in is decided here and nowhere else. `evaluateTutorTurn` takes
// three ports and knows nothing about Postgres; swapping the educational store
// in was this import line changing, which is the property the ports exist for.
//
// DISTILLATION IS NO LONGER ON THIS REQUEST. Doc 12 §5 puts it "async after
// close" and `docs/design/jobs.md` §2.1 named doing it inline as the single
// highest-value queue on the page — it spent a child's latency budget on work
// the child is not waiting for. So the two distillation ports are deliberately
// NOT passed to `evaluateTutorTurn`; the transcript port is wrapped to enqueue
// `edu.distill` instead, and `after()` drains that queue once the answer is
// already on its way back. The service still owns the algebra, unchanged — what
// moved is when it runs, not what it does.
// SOT: CLAUDE.md §The block · docs/pack/19-learning-outcomes-spec.md §3 · docs/pack/12-systems-design-prompt.md §4 §5 · docs/design/jobs.md §2.1
// SOT-KEYWORDS: tutor evaluate api route protected operation server transcript edu educational store student model distill queue async after close
import { NextRequest, NextResponse, after } from 'next/server';
import { evaluateTutorTurn, type SaveTranscript } from '@acme/app/server';
import { saveEduTranscript } from '@/lib/edu.repository';
import { drain, enqueueDistillation } from '@/lib/jobs';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

/**
 * Writes the transcript, then enqueues its distillation.
 *
 * IN THAT ORDER, and the order is the guarantee. `edu.distill`'s payload is the
 * transcript id and nothing else (`docs/design/jobs.md` §4.1), so a job enqueued
 * before its row existed would find nothing and complete — silently losing the
 * turn from the child's model. Enqueued after, the worst case is a transcript
 * with no job, which is recoverable by re-enqueueing on the same key.
 *
 * The two writes are not yet ONE transaction, which is doc 12 §6's whole reason
 * for choosing this runner. §8.3 records why: `protectedOperation` hands an
 * operation a `ctx`, not a transaction handle. `enqueue`'s `db` option is the
 * seam that closes it the day one exists.
 *
 * A turn with no storable content enqueues nothing. `distill` filters on
 * `turn.storable` and would derive an empty set, so the job would be a round
 * trip to prove a thing the caller already knows — and the safety-blocked
 * branch, which is where unstorable turns come from, is exactly the traffic that
 * should not also cost a queue insert.
 */
const saveTranscriptAndQueueDistillation: SaveTranscript = async (ctx, transcript) => {
  await saveEduTranscript(ctx, transcript);
  if (!transcript.turns.some((turn) => turn.storable)) return;
  await enqueueDistillation(transcript.sessionId);
};

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('problem' in body) ||
    !('answer' in body) ||
    typeof (body as Record<string, unknown>).problem !== 'string' ||
    typeof (body as Record<string, unknown>).answer !== 'string' ||
    !('hintDepth' in body) ||
    typeof (body as Record<string, unknown>).hintDepth !== 'number'
  ) {
    return NextResponse.json({ error: 'problem, answer, and hintDepth are required' }, { status: 400 });
  }

  const { problem, answer, hintDepth } = body as { problem: string; answer: string; hintDepth: number };

  try {
    const result = await evaluateTutorTurn(
      auth,
      request.headers,
      { problem, answer, hintDepth },
      /*
        NO `distillation` PORTS. `evaluateTutorTurn` distils only when it is
        given them, so withholding them is what takes distillation off the
        request — not a flag, and not a second code path inside the service.

        They are one object rather than three optional arguments because of what
        the three-argument version allowed: `loadBlockedTags` defaulted to "no
        tags are blocked", so supplying the other two turned distillation on with
        a guardian's erasures silently ignored. The grouped type makes that
        unrepresentable — anything that distils here must also say where
        `edu.blocked_tags` is read from. The live distiller is
        `lib/distill.service.ts`, behind the `edu.distill` job enqueued below,
        and it reads them on every run.
      */
      { saveTranscript: saveTranscriptAndQueueDistillation },
    );

    /*
      AFTER THE RESPONSE, and only the distillation queue.

      `after()` runs once the answer is already on its way to the child, which is
      doc 12 §5's "async after close" in the only shape a Vercel function can
      offer it. Scoped to `edu.distill` so a tutoring turn never picks up a
      retention sweep — those are minutes of deletes and belong to their own cron
      window (`docs/design/jobs.md` §5 also rules them un-sheddable, so they must
      not be competing with a child's turn for the same invocation's time).

      `stopWhenDone` is false: the boss stays started for the life of this warm
      lambda, so the NEXT turn's enqueue does not pay a cold start.

      A failure here is swallowed on purpose. The job row is already committed;
      whatever went wrong is the drain's problem and comes back on the queue's
      retry ladder, picked up by `/api/jobs/drain/cron`. Rethrowing would be a
      500 after a 200 has been sent.
    */
    after(async () => {
      try {
        await drain({ only: ['edu.distill'], batchSize: 5 });
      } catch (error) {
        if (error instanceof Error) reportRouteError(error);
      }
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    const status = message === 'Unauthenticated' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
