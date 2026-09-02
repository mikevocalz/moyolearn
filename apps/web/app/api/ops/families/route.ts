// GET /api/ops/families — the interim server-derived family grouping over the
// org's leads (family-groups.ts records why this is a derivation, not a
// household collection — doc 28 §2's Family/GuardianContact are unbuilt).
// SOT: docs/pack/28-crm-spec.md §2 · CLAUDE.md (The block)
// SOT-KEYWORDS: ops api families derived grouping crm protected operation route
import { NextRequest, NextResponse } from 'next/server';
import {
  CapabilityDenied,
  MembershipDenied,
  MEMBERSHIP_ROLES,
  listFamilies,
  protectedOperation,
} from '@acme/app/server';
import { loadLeads } from '@/lib/leads.repository';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

export async function GET(request: NextRequest) {
  try {
    const result = await protectedOperation(
      auth,
      request.headers,
      (ctx) => listFamilies(ctx, loadLeads),
      /*
        The same wall as the pipeline read it derives from: `export` (a lapsed
        org keeps reading its own CRM, doc 05 §2.3) with the role membership as
        the only gate that ever closes.
      */
      {
        requires: 'export',
        requiresMembership: MEMBERSHIP_ROLES,
        telemetry: { op: 'ops.families.list', resource: 'leads', action: 'read' },
      },
    );
    return NextResponse.json(result);
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
