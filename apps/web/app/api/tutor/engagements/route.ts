// GET /api/tutor/engagements — the acting tutor's engaged learners, for the
// incident intake's subject picker (and, later, the My-learners de-fixturing
// ADR-108 names).
//
// UNDER `/api/tutor`, NEVER `/api/ops`, for the incidents route's own reason:
// this read exists to feed a safety filing, and doc 31 §4.2's wall keeps the
// CRM wing pathless to anything incident-shaped. Names only in the response —
// `EngagedLearner` carries an id and a display name and has nowhere to put a
// band, a guardian or an email, so the projection discipline is structural.
//
// NO MEMBERSHIP WALL, same as `/api/tutor/incidents`: the gate inside
// `tutorEngagedLearners` is the free floor, because this feeds the filing of
// a safety report and a lapsed plan must never stand between a person and
// making one. Scope is the acting identity, applied in the repository's
// `where`.
// SOT: docs/decisions/adr-108-tutor-learner-edge.md · packages/app/features/safety/incidents.service.ts
// SOT-KEYWORDS: tutor engagements api route engaged learners subject picker roster names only
import { NextRequest, NextResponse } from 'next/server';
import { tutorEngagedLearners } from '@acme/app/server';
import { loadTutorEngagements } from '@/lib/tutor-engagement.repository';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

// "Who am I engaged with" changes when an org changes it; a cached answer
// offers a subject the roster no longer holds.
export const dynamic = 'force-dynamic';

const statusFor = (message: string): number => (message === 'Unauthenticated' ? 401 : 500);

export async function GET(request: NextRequest) {
  try {
    const learners = await tutorEngagedLearners(auth, request.headers, { loadTutorEngagements });
    return NextResponse.json({ ok: true, learners });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: statusFor(message) });
  }
}
