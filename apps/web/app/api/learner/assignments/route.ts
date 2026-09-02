// GET /api/learner/assignments — the J1 arrival signal, pull side: everything
// published to the classes this learner is enrolled in, soonest due first.
//
// A LEARNER SURFACE beside the profile route, and deliberately not the teacher
// assignments route with a flag: identity is `ctx.learnerId` and nothing else
// — no classId, no learner id, nothing in the request to forge — and the
// service resolves classes from the learner's own active enrollments before
// anything is read. Free `practise` floor (doc 05 §1.2): a lapsed card never
// stands between a child and seeing their homework.
// SOT: design/screens/learner/learner.plan/contract.md · packages/app/features/assignments/learner-assignments.service.ts
// SOT-KEYWORDS: learner assignments api route arrival due work published enrollment protected operation
import { NextRequest, NextResponse } from 'next/server';
import { learnerAssignments } from '@acme/app/server';
import { loadEnrollmentsByLearner } from '@/lib/enrollment.repository';
import { loadPublishedAssignmentsForClasses } from '@/lib/assignments.repository';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

// "Is anything due?" is a question about now; a cached answer is an assignment
// a child never learns arrived.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const assignments = await learnerAssignments(
      {
        loadEnrollmentsByLearner,
        loadPublishedAssignments: loadPublishedAssignmentsForClasses,
      },
      auth,
      request.headers,
    );
    return NextResponse.json({ ok: true, assignments });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthenticated' ? 401 : 500 });
  }
}
