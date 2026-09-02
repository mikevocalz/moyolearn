// GET /api/ops/families — the org's household rows (ADR-109), each with the
// stage rollup over its leads. The derivation this route used to serve
// retired when doc 28 §2's Family object landed as a collection.
// SOT: docs/pack/28-crm-spec.md §2 · docs/decisions/adr-109-family-household-object.md · CLAUDE.md (The block)
// SOT-KEYWORDS: ops api families household rollup crm protected operation route
import { NextRequest, NextResponse } from 'next/server';
import {
  CapabilityDenied,
  MembershipDenied,
  MEMBERSHIP_ROLES,
  listFamilies,
  protectedOperation,
} from '@acme/app/server';
import { loadLeads } from '@/lib/leads.repository';
import { loadFamilies } from '@/lib/families.repository';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

export async function GET(request: NextRequest) {
  try {
    const result = await protectedOperation(
      auth,
      request.headers,
      (ctx) => listFamilies(ctx, { loadFamilies, loadLeads }),
      /*
        The same wall as the pipeline read beside it: `export` (a lapsed
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
