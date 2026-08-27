// GET /api/guardian/reports/[sessionId] — one full report, doc 34 §2's eight
// blocks in fixed order, question refs resolved through the degrade ladder
// (crop → extracted text → "source expired").
//
// OPENING IS THE VISIBILITY LOOP: the service writes `guardianViewedAt` on
// first open, which is what makes viewed-rate (not sent-rate) the honest org
// metric (§5). Crop URLs in the response are CANONICAL and unsigned — the
// client renders them through `/api/media/view`, the one signing door, so this
// route never mints a token it would then have to expire.
//
// 404 for not-found and not-yours alike — a distinguishable 403 would be a
// membership oracle over which children have session reports.
// SOT: docs/pack/34-session-summary-reports.md §2 §5 · docs/pack/29-bunny-media-spec.md §5
// SOT-KEYWORDS: guardian report api route eight blocks viewed loop degrade source expired crop resolve
import { NextRequest, NextResponse } from 'next/server';
import { guardianSummaryReport } from '@acme/app/server';
import {
  loadGuardianWards,
  loadSummaryBySession,
  markGuardianViewed,
  resolveCaptureCrop,
} from '@/lib/summary.repository';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  if (!sessionId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const report = await guardianSummaryReport(auth, request.headers, sessionId, {
      loadGuardianWards,
      loadSummary: loadSummaryBySession,
      markGuardianViewed,
      resolveCaptureCrop,
    });
    if (report === null) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthenticated' ? 401 : 500 });
  }
}
