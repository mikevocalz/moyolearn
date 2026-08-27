// GET /api/guardian/safety-status — doc 12 §5's guardian-visible half.
//
// The child's half of the fail-closed rule has been on screen since
// `TutorStage`'s `paused` case: "Natalie is taking a break." This is the other
// half, and it is a separate route from anything the tutor calls on purpose —
// the learner surfaces must never fetch it. A child reading their own safety
// file is doc 07 §3 layer 4's "never punished" turned inside out.
//
// No paywall, price or upgrade prompt is reachable from what this returns, and
// that is not incidental: S12 is a guardian screen but it renders inside the
// same `(site)` shell a learner uses, so the payload is deliberately only a
// status and a list of alerts.
// SOT: docs/pack/12-systems-design-prompt.md §5 · docs/pack/07-security-child-ai-safety-spec.md §S26 · docs/pack/04-screen-briefs.md §S12
// SOT-KEYWORDS: guardian safety status api route paused alerts protected operation safety events
import { NextRequest, NextResponse } from 'next/server';
import { guardianSafetyStatus } from '@acme/app/server';
import { loadGuardianSafetyEvents } from '@/lib/safety-event.repository';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

// "Is the tutor stopped right now" is a question about now. A cached answer is
// the failure this route exists to fix, wearing a 200.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const status = await guardianSafetyStatus(auth, request.headers, loadGuardianSafetyEvents);
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthenticated' ? 401 : 500 });
  }
}
