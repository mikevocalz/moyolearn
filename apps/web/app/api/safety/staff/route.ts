// GET /api/safety/staff — the org's assignable safety staff, for the queue's
// assignment control.
//
// UNDER `/api/safety` beside the incidents route because it is incident
// tooling, not a people directory: the only consumer is the triage panel's
// assignee picker, the rows are owner/manager only, and each carries id +
// name + role + `me` and nothing else. The wall is the queue's own —
// `requiresMembership: ['owner', 'manager']`, set inside `incidentStaffRoster`
// so no route can lower it — and both refusals flatten to 403 for the same
// reason the incidents route flattens them: nothing on the safety side is
// ever an upsell surface.
// SOT: packages/app/features/safety/incidents.service.ts · apps/web/lib/incident-staff.repository.ts · docs/pack/31-grade-voice-safety-incidents.md §4.2 §5.3
// SOT-KEYWORDS: safety staff roster api route assignee picker owner manager me
import { NextRequest, NextResponse } from 'next/server';
import { CapabilityDenied, MembershipDenied, incidentStaffRoster } from '@acme/app/server';
import { loadIncidentStaff } from '@/lib/incident-staff.repository';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

// Who can take an incident is a claim about now — a cached roster offers a
// picker somebody who left the org an hour ago.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const staff = await incidentStaffRoster(auth, request.headers, { loadIncidentStaff });
    return NextResponse.json({ ok: true, staff });
  } catch (error) {
    if (error instanceof MembershipDenied || error instanceof CapabilityDenied) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json(
      { error: message },
      { status: message === 'Unauthenticated' ? 401 : 500 },
    );
  }
}
