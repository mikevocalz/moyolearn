// GET /api/ops/leads — cursor-paginated CRM pipeline for the ops dashboard.
// SOT: docs/pack/28-crm-spec.md §3 · CLAUDE.md (The block)
// SOT-KEYWORDS: ops api leads cursor pagination crm protected operation route
import { NextRequest, NextResponse } from 'next/server';
import {
  CapabilityDenied,
  listLeads,
  protectedOperation,
  type LeadSortField,
} from '@acme/app/server';
import type { Stage } from '@acme/app';
import { loadLeads } from '@/lib/leads.repository';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

const SORT_FIELDS: readonly LeadSortField[] = ['family', 'stage', 'owner', 'sessions', 'value'];

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  try {
    const result = await protectedOperation(
      auth,
      request.headers,
      async (ctx) => {
        /*
          Everything the client can influence is parsed and narrowed here. `orgId`
          is NOT among it — it comes off `ctx`, because a tenant id accepted from
          a query string is a tenant id an attacker can change.
        */
        const rawSort = params.get('sortField');
        const sortField = SORT_FIELDS.find((f) => f === rawSort);

        return listLeads(
          ctx,
          {
            cursor: params.get('cursor') ?? undefined,
            limit: Number(params.get('limit')) || 25,
            q: params.get('q') ?? undefined,
            stage: (params.get('stage') as Stage | null) ?? undefined,
            onlyAttention: params.get('attention') === '1',
            sort: sortField ? { field: sortField, desc: params.get('sortDesc') === '1' } : undefined,
          },
          loadLeads,
        );
      },
      /*
        Reading the pipeline is `export`, not `write`. Doc 05 §2.3 is explicit
        that a business's data is never hostage: after an ops trial or plan ends
        the dashboard stays readable and exportable, and `entitlementsFor` keeps
        `canExport` true on every status for exactly that reason. Gating this
        read on `write` would take a lapsed org's own CRM away from it.
      */
      { requires: 'export', telemetry: { op: 'ops.leads.list', resource: 'leads', action: 'read' } },
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    const status = error instanceof CapabilityDenied ? error.status
      : message === 'Unauthenticated' ? 401
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
