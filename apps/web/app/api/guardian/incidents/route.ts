// GET /api/guardian/incidents — doc 31 §4.2's family view.
// POST /api/guardian/incidents — §4.1's acknowledgment loop.
//
// A GUARDIAN SURFACE, and separate from anything the tutor calls on purpose —
// the same rule the safety-status route beside it states: a child reading their
// own incident file is doc 07 §3 layer 4's "never punished" turned inside out.
// The composition root for that is the repository, which resolves ACTIVE
// guardianships before it queries and returns nothing to a session that has none.
//
// The response is §5.2's four sections, already assembled: What happened → What
// the tutor did → What happens next → Talk about it. Assembling them in a screen
// would let a phone show less than a laptop, and this is the one surface that
// cannot afford that.
//
// No paywall, price or upgrade prompt is reachable from what this returns, and
// the operation runs at the free `practise` floor deliberately: doc 05 §1.2 and
// CLAUDE.md both forbid a lapsed card standing between a family and a safety
// record about their own child.
// SOT: docs/pack/31-grade-voice-safety-incidents.md §4.1 §4.2 §5.2 · packages/app/features/safety/incidents.service.ts
// SOT-KEYWORDS: guardian incidents api route acknowledge protected operation own learner guardian visible
import { NextRequest, NextResponse } from 'next/server';
import { acknowledgeGuardianIncident, guardianIncidents } from '@acme/app/server';
import {
  loadGuardianIncidents,
  loadIncident,
  saveIncident,
} from '@/lib/incident.repository';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

// "What has been filed about my child" is a question about now, and a cached
// answer is the failure this route exists to fix, wearing a 200.
export const dynamic = 'force-dynamic';

const statusFor = (message: string): number => (message === 'Unauthenticated' ? 401 : 500);

export async function GET(request: NextRequest) {
  try {
    const incidents = await guardianIncidents(auth, request.headers, { loadGuardianIncidents });
    return NextResponse.json({ ok: true, incidents });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: statusFor(message) });
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  /*
    `incidentId` is the ONLY thing this route accepts. Not the learner, not the
    guardian, not a timestamp — the acknowledging identity comes from `ctx` and
    the clock from the server. An id is still only a CLAIM, which is why
    `acknowledgeGuardianIncident` re-checks it against the caller's own wards
    before writing: otherwise a guardian could put their user id in the audit
    trail of another family's case.
  */
  if (
    typeof body !== 'object' ||
    body === null ||
    !('incidentId' in body) ||
    typeof (body as Record<string, unknown>).incidentId !== 'string' ||
    (body as { incidentId: string }).incidentId.length === 0
  ) {
    return NextResponse.json({ error: 'incidentId is required' }, { status: 400 });
  }

  const { incidentId } = body as { incidentId: string };

  try {
    const view = await acknowledgeGuardianIncident(auth, request.headers, incidentId, {
      loadGuardianIncidents,
      loadIncident,
      saveIncident,
    });
    /*
      404 rather than 403 when the incident is not theirs, and the two are
      deliberately indistinguishable from outside. A 403 on somebody else's
      incident id confirms that the incident exists, which is a membership oracle
      over a list of children who have had safety incidents.
    */
    if (view === null) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, incident: view });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: statusFor(message) });
  }
}
