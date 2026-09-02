// GET /api/ops/leads — cursor-paginated CRM pipeline for the ops surfaces.
// POST /api/ops/leads — create a lead at the pipeline's first stage.
// SOT: docs/pack/28-crm-spec.md §2–§3 · CLAUDE.md (The block)
// SOT-KEYWORDS: ops api leads cursor pagination create crm protected operation route
import { NextRequest, NextResponse } from 'next/server';
import {
  CapabilityDenied,
  MembershipDenied,
  MEMBERSHIP_ROLES,
  createLead,
  listLeads,
  parseNewLead,
  protectedOperation,
  type LeadSortField,
} from '@acme/app/server';
import type { Stage } from '@acme/app';
import { createLeadRecord, loadLeads } from '@/lib/leads.repository';
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

        Which makes the ROLE the only wall: `export` is free on every status
        there is, so without `requiresMembership` any authenticated session was
        one org edge away from a pipeline of family names. Every doc 06 §1 role
        may read — running the pipeline is what an org's staff are — but a
        session with no role in the org is not staff, whatever it pays.
      */
      {
        requires: 'export',
        requiresMembership: MEMBERSHIP_ROLES,
        telemetry: { op: 'ops.leads.list', resource: 'leads', action: 'read' },
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

export async function POST(request: NextRequest) {
  try {
    const result = await protectedOperation(
      auth,
      request.headers,
      async (ctx) => {
        /*
          The floor is pure and tested (`parseNewLead`): the family name is the
          one thing a lead cannot exist without, money is whole non-negative
          CENTS, and the STAGE is never read from the body — the service pins a
          new lead to the pipeline's first stage, because a client that could
          choose its starting stage could skip the funnel. `orgId` comes off
          `ctx` inside the repository, never from input.
        */
        const parsed = parseNewLead(await request.json().catch(() => null));
        if (!parsed.ok) return { ok: false as const, error: parsed.error };
        const lead = await createLead(ctx, parsed.input, createLeadRecord);
        if (lead === null) return { ok: false as const, error: 'No organization on this session.' };
        return { ok: true as const, lead };
      },
      /*
        Creating a lead is the organisation's data changing, so it is `write` —
        and the same role wall as the stage move: owner and manager run the
        pipeline, the scheduler feeds it as a direct effect of booking
        (doc 06 §1). Finance reads; it does not add families.
      */
      {
        requires: 'write',
        requiresMembership: ['owner', 'manager', 'scheduler'],
        telemetry: { op: 'ops.leads.create', resource: 'leads', action: 'write' },
      },
    );
    return NextResponse.json(result, { status: result.ok ? 201 : 422 });
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
