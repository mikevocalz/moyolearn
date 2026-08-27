// GET  /api/summary/queue — doc 34 §5's Cool surface: the draft-review queue
//                           plus the recent report trail, for the DataTable.
// POST /api/summary/queue — the two staff actions: approve a draft (the human
//                           owns the note) and suppress (logged, never silent).
//
// DELIBERATELY NOT UNDER /api/ops. Doc 34 §3 extends doc 23's wall — "CRM
// sales surfaces never read summaries" — and `tooling/check-crm-wall.mjs`
// walks the CRM roots' import graphs. A queue route living under the ops tree
// would be inside the walled wing by construction; this one sits beside the
// tutor routes instead, and the wall check names the summary modules so an ops
// import of them fails the build.
//
// The boundary inside all three service calls is `requiresMembership:
// ['owner', 'manager']` — the role wall, which is what `requires: 'write'`
// alone never was: `write` is a billing capability an active family plan also
// satisfies, so "no family plan grants it" was false and a paying guardian
// could reach this queue. The same documented org-scoping gap the incident
// triage queue records still applies.
// SOT: docs/pack/34-session-summary-reports.md §5 · docs/pack/23-crm-spec.md §2 · packages/app/features/summary/summary.service.ts
// SOT-KEYWORDS: summary queue api route drafts approve suppress cool datatable crm wall staff write
import { NextRequest, NextResponse } from 'next/server';
import {
  approveSummaryDraft,
  summaryQueue,
  suppressSummary,
  CapabilityDenied,
  MembershipDenied,
} from '@acme/app/server';
import {
  loadSummaryBySession,
  loadSummaryQueue,
  saveSummaryReport,
} from '@/lib/summary.repository';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

export const dynamic = 'force-dynamic';

// Both refusals flatten to 403, the same choice the incident route makes: a
// staff review queue is never an upsell surface, so a 402 has no business
// leaving it even when the underlying refusal was the plan gate's.
const statusFor = (error: unknown, message: string): number =>
  error instanceof MembershipDenied || error instanceof CapabilityDenied
    ? 403
    : message === 'Unauthenticated'
      ? 401
      : 500;

export async function GET(request: NextRequest) {
  try {
    const rows = await summaryQueue(auth, request.headers, { loadSummaryQueue });
    return NextResponse.json({ ok: true, rows });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: statusFor(error, message) });
  }
}

interface QueueAction {
  readonly action: 'approve' | 'suppress';
  readonly sessionId: string;
  readonly tutorDraft?: string;
  readonly reason?: string;
}

function decodeAction(body: unknown): QueueAction | null {
  if (typeof body !== 'object' || body === null) return null;
  const raw = body as Record<string, unknown>;
  if (typeof raw.sessionId !== 'string' || raw.sessionId.length === 0) return null;
  if (raw.action !== 'approve' && raw.action !== 'suppress') return null;
  return {
    action: raw.action,
    sessionId: raw.sessionId,
    tutorDraft: typeof raw.tutorDraft === 'string' ? raw.tutorDraft : undefined,
    reason: typeof raw.reason === 'string' ? raw.reason : undefined,
  };
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const input = decodeAction(body);
  if (input === null) {
    return NextResponse.json({ error: 'action and sessionId are required' }, { status: 400 });
  }

  const ports = { loadSummary: loadSummaryBySession, saveSummary: saveSummaryReport };

  try {
    if (input.action === 'approve') {
      const ok = await approveSummaryDraft(
        auth,
        request.headers,
        { sessionId: input.sessionId, tutorDraft: input.tutorDraft },
        ports,
      );
      if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ ok: true });
    }

    // Suppression demands its reason at the door — a takedown nobody can
    // explain is a takedown that gets repeated (doc 34 §3).
    if (!input.reason || input.reason.trim() === '') {
      return NextResponse.json({ error: 'reason is required to suppress' }, { status: 400 });
    }
    const ok = await suppressSummary(
      auth,
      request.headers,
      { sessionId: input.sessionId, reason: input.reason },
      ports,
    );
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: statusFor(error, message) });
  }
}
