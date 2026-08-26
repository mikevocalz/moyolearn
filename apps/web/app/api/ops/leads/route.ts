// GET /api/ops/leads — cursor-paginated CRM pipeline for the ops dashboard.
// SOT: docs/pack/28-crm-spec.md §3 · CLAUDE.md (The block)
// SOT-KEYWORDS: ops api leads cursor pagination crm protected operation route
import { NextRequest, NextResponse } from 'next/server';
import { listLeads, protectedOperation, type LeadSortField } from '@acme/app/server';
import type { Stage } from '@acme/app';
import { auth } from '@/lib/auth';

const SORT_FIELDS: readonly LeadSortField[] = ['family', 'stage', 'owner', 'sessions', 'value'];

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  try {
    const result = await protectedOperation(auth, request.headers, async (ctx) => {
      /*
        Everything the client can influence is parsed and narrowed here. `orgId`
        is NOT among it — it comes off `ctx`, because a tenant id accepted from
        a query string is a tenant id an attacker can change.
      */
      const rawSort = params.get('sortField');
      const sortField = SORT_FIELDS.find((f) => f === rawSort);

      return listLeads(
        { orgId: ctx.orgId },
        {
          cursor: params.get('cursor') ?? undefined,
          limit: Number(params.get('limit')) || 25,
          q: params.get('q') ?? undefined,
          stage: (params.get('stage') as Stage | null) ?? undefined,
          onlyAttention: params.get('attention') === '1',
          sort: sortField ? { field: sortField, desc: params.get('sortDesc') === '1' } : undefined,
        },
      );
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthenticated' ? 401 : 500 });
  }
}
