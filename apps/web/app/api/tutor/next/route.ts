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
import { generatePracticeProblem } from '@acme/student-model/pure';
import { loadEduPriorFacts } from '@/lib/edu.repository';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

export interface NextProblemResponse {
  skillTitle: string;
  problem: string;
}

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

      const now = new Date().toISOString();
      const reviews: string[] = [];
      const mastery: { skillTitle: string; p: number }[] = [];

      for (const fact of facts) {
        if (fact.kind === 'review') {
          if (fact.dueAt <= now) reviews.push(fact.skillTitle);
        } else if (fact.kind === 'mastery') {
          mastery.push({ skillTitle: fact.skillTitle, p: fact.p });
        }
      }

      // Prioritize due reviews, then lowest mastery, then seeded skills.
      const skill =
        reviews[0] ??
        mastery.sort((a, b) => a.p - b.p)[0]?.skillTitle ??
        SEED_SKILLS[Math.floor(Math.random() * SEED_SKILLS.length)];

      const problem = generatePracticeProblem(skill);
      if (!problem) throw new Error('No practice problem for skill');
      return { skillTitle: skill, problem };
    }, { telemetry: { op: 'tutor.next.problem', resource: 'studentModelFacts', action: 'read' } });
    return NextResponse.json(next satisfies NextProblemResponse);
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    const status = message === 'Unauthenticated' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
