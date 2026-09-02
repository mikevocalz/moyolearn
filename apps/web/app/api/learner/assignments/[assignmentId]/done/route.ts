// POST /api/learner/assignments/[assignmentId]/done — the learner's
// self-reported "I did it" for one published assignment.
//
// A LEARNER SURFACE beside the list route, same walls: identity is
// `ctx.learnerId` and nothing else, and the only id in the request must
// resolve through the learner's OWN enrollments to a published row — foreign,
// draft, and closed ids all return the same 404. Idempotent by design: a
// double-tap re-returns the existing done state as success. Free `practise`
// floor (doc 05 §1.2): a lapsed card never stands between a child and saying
// their homework is done.
// SOT: design/screens/learner/learner.plan/contract.md · packages/app/features/assignments/learner-assignments.service.ts
// SOT-KEYWORDS: learner assignment done api route mark complete self-report idempotent protected operation
import { NextRequest, NextResponse } from 'next/server';
import { markAssignmentDone } from '@acme/app/server';
import { loadEnrollmentsByLearner } from '@/lib/enrollment.repository';
import { loadPublishedAssignmentsForClasses } from '@/lib/assignments.repository';
import {
  createAssignmentCompletion,
  loadCompletionsForLearnerAssignments,
} from '@/lib/assignment-completions.repository';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  const { assignmentId } = await params;
  if (!assignmentId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const assignment = await markAssignmentDone(
      {
        loadEnrollmentsByLearner,
        loadPublishedAssignments: loadPublishedAssignmentsForClasses,
        loadCompletionsForAssignments: loadCompletionsForLearnerAssignments,
        createCompletion: createAssignmentCompletion,
      },
      auth,
      request.headers,
      assignmentId,
    );
    if (assignment === null) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, assignment });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthenticated' ? 401 : 500 });
  }
}
