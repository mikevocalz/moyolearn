// POST   /api/guardian/reports/[sessionId]/share — mint the teacher link.
// DELETE /api/guardian/reports/[sessionId]/share — revoke it, now.
//
// GUARDIAN-INITIATED, BOTH DOORS (doc 34 §3): the guardian owns consent —
// that is the FERPA posture — so the ward check runs inside the service and a
// staff or learner session gets the same null a stranger does. The response to
// POST is the ONLY place the raw token ever exists; the row keeps a hash, and
// re-sharing rotates the secret, which retires any previously shared link.
//
// Free `practise` floor: consent over a child's record is never a paid
// capability.
// SOT: docs/pack/34-session-summary-reports.md §3 · packages/app/features/summary/summary.service.ts
// SOT-KEYWORDS: teacher share api route mint revoke token guardian consent expiring revocable
import { NextRequest, NextResponse } from 'next/server';
import { createTeacherShare, revokeTeacherShare } from '@acme/app/server';
import {
  loadGuardianWards,
  loadSummaryBySession,
  saveSummaryReport,
} from '@/lib/summary.repository';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

export const dynamic = 'force-dynamic';

const ports = {
  loadGuardianWards,
  loadSummary: loadSummaryBySession,
  saveSummary: saveSummaryReport,
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  if (!sessionId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const grant = await createTeacherShare(auth, request.headers, sessionId, ports);
    if (grant === null) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, share: grant });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthenticated' ? 401 : 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  if (!sessionId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const revoked = await revokeTeacherShare(auth, request.headers, sessionId, ports);
    if (!revoked) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthenticated' ? 401 : 500 });
  }
}
