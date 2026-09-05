// GET /api/tutor/next — adaptive next practice problem from the student model.
//
// Reads the EDUCATIONAL store through `edu.repository.ts` (doc 12 §4), like
// every other reader of the model. It used to `find` `studentModelFacts` inline
// and pull `dueAt` and `p` out of the `detail` blob with a cast each; the store
// moved, and the typed union removes the casts with it.
// SOT: docs/pack/19-learning-outcomes-spec.md §3 · docs/pack/23-tutorstage-handoff.md §3 · docs/pack/12-systems-design-prompt.md §4
// SOT-KEYWORDS: tutor next adaptive practice problem student model review mastery edu educational store
import { NextRequest, NextResponse } from 'next/server';
import { protectedOperation } from '@acme/app/server';
import { generatePracticeProblem, pickNextSkill, type NextProblem } from '@acme/student-model/pure';
import { loadEduPriorFacts } from '@/lib/edu.repository';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

/**
 * The response shape lives in `@acme/student-model/pure` beside the picker that
 * produces it, so the surfaces reading it and the branch choosing it cannot
 * describe the same value differently.
 */
export type NextProblemResponse = NextProblem;

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
      return { ...chosen, problem };
    }, { telemetry: { op: 'tutor.next.problem', resource: 'studentModelFacts', action: 'read' } });
    return NextResponse.json(next satisfies NextProblemResponse);
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    const status = message === 'Unauthenticated' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
