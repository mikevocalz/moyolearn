// POST /api/ops/leads/:id/stage — move a lead along the pipeline.
// SOT: docs/pack/28-crm-spec.md §3 · CLAUDE.md (The block)
// SOT-KEYWORDS: ops api lead stage write pipeline protected operation route
import { NextRequest, NextResponse } from 'next/server';
import {
  CapabilityDenied,
  MANUAL_STAGES,
  commitStageChange,
  protectedOperation,
} from '@acme/app/server';
import { saveLeadStage } from '@/lib/leads.repository';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = await protectedOperation(
      auth,
      request.headers,
      async (ctx) => {
        const body = (await request.json()) as { stage?: string };
        /*
          Validate against the MANUAL list, not the Stage union: `At risk` is a
          derived health state (doc 28 §6), so accepting it here would let a
          client hand-set a value the scorer owns.
        */
        const stage = MANUAL_STAGES.find((s) => s === body.stage);
        if (!stage) {
          return { ok: false as const, error: `\`${body.stage}\` is not a stage you can move a family to.` };
        }
        /*
          A miss is reported, not swallowed. The write is scoped to the caller's
          org in the repository, so "no row matched" means the id belongs to
          nobody the caller can see — answering `ok` there would leave the
          optimistic row showing a stage the database never took.
        */
        const saved = await commitStageChange(ctx, { leadId: id, to: stage }, saveLeadStage);
        if (!saved) {
          return { ok: false as const, error: 'That family is no longer in your pipeline.' };
        }
        return { ok: true as const, id, stage, orgId: ctx.orgId };
      },
      /*
        Moving a family along the pipeline is the organisation's data changing,
        so it is `write` — the capability doc 05 §2.3 takes away at the end of an
        ops trial while leaving the pipeline readable and exportable. The
        client's own gate can be empty, stale, or bypassed entirely; this is the
        refusal that counts.
      */
      { requires: 'write', telemetry: { op: 'ops.leads.stage', resource: 'leads', action: 'write' } },
    );

    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    const status = error instanceof CapabilityDenied ? error.status
      : message === 'Unauthenticated' ? 401
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
