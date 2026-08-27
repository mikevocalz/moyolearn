// GET /api/guardian/reports — doc 34 §5's family feed: one card per published
// session report, headline + mastery delta, newest first.
//
// A GUARDIAN SURFACE beside the incidents and safety-status routes, and
// deliberately not anything a tutor or learner calls: the repository resolves
// ACTIVE guardianships before it queries, and the service's projection filters
// again on the same facts — a learner session, or a guardian with no wards,
// gets an empty list rather than an error, because "you have no reports" and
// "you may see no reports" must be indistinguishable from outside.
//
// Free `practise` floor: doc 05 §1.2 and CLAUDE.md — a lapsed card never
// stands between a family and the record of their child's learning.
// SOT: docs/pack/34-session-summary-reports.md §5 · packages/app/features/summary/summary.service.ts
// SOT-KEYWORDS: guardian reports api route family feed cards summary list protected operation
import { NextRequest, NextResponse } from 'next/server';
import { guardianSummaries } from '@acme/app/server';
import { loadGuardianSummaries } from '@/lib/summary.repository';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

// "What is new about my child" is a question about now; a cached answer is a
// report a parent never learns exists.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const reports = await guardianSummaries(auth, request.headers, { loadGuardianSummaries });
    return NextResponse.json({ ok: true, reports });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthenticated' ? 401 : 500 });
  }
}
