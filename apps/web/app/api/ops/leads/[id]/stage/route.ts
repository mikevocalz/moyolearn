// POST /api/ops/leads/:id/stage — move a lead along the pipeline.
// SOT: docs/pack/28-crm-spec.md §3 · CLAUDE.md (The block)
// SOT-KEYWORDS: ops api lead stage write pipeline protected operation route
import { NextRequest, NextResponse } from 'next/server';
import { MANUAL_STAGES, commitStageChange, protectedOperation } from '@acme/app/server';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = await protectedOperation(auth, request.headers, async (ctx) => {
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
      // Persistence is the fixture layer's in-memory map until the CRM
      // repositories land (doc 28 PR-72). Everything around it — auth, tenancy
      // from ctx, validation, response shape — is already the real contract.
      commitStageChange({ leadId: id, to: stage });
      return { ok: true as const, id, stage, orgId: ctx.orgId };
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthenticated' ? 401 : 500 });
  }
}
