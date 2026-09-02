// GET /api/ops/leads/:id — one CRM record, for the route-based lead detail.
// SOT: design/screens/org/org.crm/contract.md · docs/pack/28-crm-spec.md §2 · CLAUDE.md (The block)
// SOT-KEYWORDS: ops api lead detail record crm protected operation route
import { NextRequest, NextResponse } from 'next/server';
import {
  CapabilityDenied,
  MembershipDenied,
  MEMBERSHIP_ROLES,
  getLead,
  protectedOperation,
} from '@acme/app/server';
import { loadLead } from '@/lib/leads.repository';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const lead = await protectedOperation(
      auth,
      request.headers,
      /*
        The repository resolves the id WHERE it also matches `ctx.orgId`, so a
        guessed id from another tenant is a 404 here, indistinguishable from a
        record that never existed — which is the point.
      */
      (ctx) => getLead(ctx, id, loadLead),
      /*
        Reading one record is the same read as reading the pipeline: `export`,
        never `write` — doc 05 §2.3 keeps a lapsed org's own CRM readable — and
        the role wall (`requiresMembership`) is what keeps a paying session with
        no role in the org out of a page of family names.
      */
      {
        requires: 'export',
        requiresMembership: MEMBERSHIP_ROLES,
        telemetry: { op: 'ops.leads.detail', resource: 'leads', action: 'read' },
      },
    );
    if (lead === null) {
      return NextResponse.json({ error: 'Not in your pipeline.' }, { status: 404 });
    }
    return NextResponse.json({ lead });
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
