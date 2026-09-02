// GET /api/ops/sessions — today's scheduled human sessions for the ops hero.
// SOT: docs/decisions/adr-110-sessions-object.md · CLAUDE.md (The block)
// SOT-KEYWORDS: ops api sessions today hero protected operation route
import { NextRequest, NextResponse } from 'next/server';
import {
  CapabilityDenied,
  MembershipDenied,
  MEMBERSHIP_ROLES,
  listSessions,
  protectedOperation,
} from '@acme/app/server';
import { loadSessions } from '@/lib/sessions.repository';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

export async function GET(request: NextRequest) {
  try {
    const sessions = await protectedOperation(
      auth,
      request.headers,
      (ctx) => listSessions(ctx, loadSessions),
      /*
        The same wall as the pipeline read beside it: `export` (a lapsed org
        keeps reading its own calendar, doc 05 §2.3) with the role membership
        as the only gate that ever closes.
      */
      {
        requires: 'export',
        requiresMembership: MEMBERSHIP_ROLES,
        telemetry: { op: 'ops.sessions.today', resource: 'sessions', action: 'read' },
      },
    );
    return NextResponse.json({ sessions });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    const status = error instanceof CapabilityDenied || error instanceof MembershipDenied
      ? error.status
      : message === 'Unauthenticated' ? 401
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
