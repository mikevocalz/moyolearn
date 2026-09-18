// GET /api/tutor/next — adaptive next practice problem from the student model.
//
// Reads the EDUCATIONAL store through `edu.repository.ts` (doc 12 §4), like
// every other reader of the model. It used to `find` `studentModelFacts` inline
// and pull `dueAt` and `p` out of the `detail` blob with a cast each; the store
// moved, and the typed union removes the casts with it.
// SOT: docs/pack/19-learning-outcomes-spec.md §3 · docs/pack/23-tutorstage-handoff.md §3 · docs/pack/12-systems-design-prompt.md §4
// SOT-KEYWORDS: tutor next adaptive practice problem student model review mastery edu educational store
import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { protectedOperation, problemDigest } from '@acme/app/server';
import { generatePracticeProblem, pickNextSkill, type NextProblem } from '@acme/student-model/pure';
import { issueEduQuestion, loadEduPriorFacts } from '@/lib/edu.repository';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

/**
 * The response shape lives in `@acme/student-model/pure` beside the picker that
 * produces it, so the surfaces reading it and the branch choosing it cannot
 * describe the same value differently.
 */
export type NextProblemResponse = NextProblem & {
  /**
   * The server's handle on the question it just asked.
   *
   * Sent because `/api/tutor/evaluate` grades nothing without it: the answer is
   * checked against the revision this response issued, held under a row lock
   * for the write. A client can quote this pair back and cannot mint one, which
   * is the difference between the server knowing what it asked and taking the
   * learner's word for it.
   */
  evidence: { questionId: string; revision: string };
};

/**
 * How long an issued question stays gradable.
 *
 * Seven days, matched by `questions_gradable_window` in `edu_questions.sql` —
 * the constraint is the promise and this constant is the caller honouring it.
 * Long enough that a child who closes the app on Friday can answer on Monday;
 * short enough that a question nobody came back to is not a standing licence to
 * write to their model.
 */
const QUESTION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const SEED_SKILLS = [
  'Number sense',
  'Order of operations',
  'Fractions',
  'Word problems',
];

export async function GET(request: NextRequest) {
  try {
    const next = await protectedOperation(auth, request.headers, async (ctx) => {
      const facts = await loadEduPriorFacts(ctx);

      const chosen = pickNextSkill(facts, new Date().toISOString(), SEED_SKILLS);
      const problem = generatePracticeProblem(chosen.skillTitle);
      if (!problem) throw new Error('No practice problem for skill');

      /*
        ISSUED BEFORE IT IS SENT, and the order is the guarantee. A question the
        learner holds but the store does not is one the grader will refuse —
        recoverable, the child simply gets no tick. The reverse, responding
        first and recording after, would be a question a retry could grade
        against a row that never landed.

        `evaluationReady` is true because this problem came out of
        `generatePracticeProblem` — the server composed it, so there is no source
        to read and nothing for a human to confirm. A photographed page is the
        other case and is issued unready by whatever records it; see
        `docs/verification/homework-v3/docs-and-status.md` for what is still
        outstanding there.
      */
      const issuedAt = new Date();
      const evidence = { questionId: randomUUID(), revision: randomUUID() };
      await issueEduQuestion(ctx, {
        ...evidence,
        problemDigest: problemDigest(problem),
        evaluationReady: true,
        issuedAt: issuedAt.toISOString(),
        expiresAt: new Date(issuedAt.getTime() + QUESTION_TTL_MS).toISOString(),
      });

      return { ...chosen, problem, evidence };
    }, { telemetry: { op: 'tutor.next.problem', resource: 'studentModelFacts', action: 'read' } });
    return NextResponse.json(next satisfies NextProblemResponse);
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    const status = message === 'Unauthenticated' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
