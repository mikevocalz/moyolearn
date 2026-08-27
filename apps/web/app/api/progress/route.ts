// GET /api/progress — the learner's student model, as the progress surfaces read it.
//
// Reads the EDUCATIONAL store through `edu.repository.ts`, not Payload. It used
// to `find` `studentModelFacts` inline and pick values out of the `detail` blob
// with a cast per field; that store is no longer the one the tutor writes (doc
// 12 §4), and the blob was also where the bugs were — `skillTitle` is absent
// from a scaffolding fact's detail, so the old fallback keyed that row by the
// whole SENTENCE and shipped "Gets going on Order of operations with little
// help" as a skill name.
// SOT: docs/pack/19-learning-outcomes-spec.md §3 · docs/pack/22-reporting-charts-spec.md §2 · docs/pack/12-systems-design-prompt.md §4
// SOT-KEYWORDS: progress api mastery review scaffolding student model edu educational store protected operation
import { NextRequest, NextResponse } from 'next/server';
import { protectedOperation } from '@acme/app/server';
import { loadEduPriorFacts } from '@/lib/edu.repository';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

export interface ProgressResponse {
  masteryBySkill: Record<string, number>;
  reviewBySkill: Record<string, string>;
  scaffoldingBySkill: Record<string, number>;
}

export async function GET(request: NextRequest) {
  try {
    const snapshot = await protectedOperation(auth, request.headers, async (ctx) => {
      const facts = await loadEduPriorFacts(ctx);

      const mastery: Record<string, number> = {};
      const review: Record<string, string> = {};
      const scaffolding: Record<string, number> = {};

      for (const fact of facts) {
        /*
          Keyed on the discriminant, so every value comes off a field the type
          guarantees is there. `scaffolding` is keyed by `skillId` because
          `ScaffoldingFact` has no title — the constructor spends it on the
          sentence — and `skillId` is the same curriculum label the other two
          kinds title. Inventing a title here would be a second author for a
          string `facts.ts` owns.
        */
        if (fact.kind === 'mastery') mastery[fact.skillTitle] = fact.p;
        else if (fact.kind === 'review') review[fact.skillTitle] = fact.dueAt;
        else if (fact.kind === 'scaffolding') scaffolding[fact.skillId] = fact.hintDepth;
      }
      return { mastery, review, scaffolding };
    }, { telemetry: { op: 'progress.snapshot', resource: 'studentModelFacts', action: 'read' } });
    return NextResponse.json({
      masteryBySkill: snapshot.mastery,
      reviewBySkill: snapshot.review,
      scaffoldingBySkill: snapshot.scaffolding,
    } satisfies ProgressResponse);
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    const status = message === 'Unauthenticated' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
