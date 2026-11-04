// Authenticated family printing surface. Browser Print -> Save as PDF.
// Uses the same ACTIVE-guardianship guard as the report detail route; there
// is no independent learnerId, file URL or public share token in the request.
import { NextRequest, NextResponse } from 'next/server';
import { guardianSummaryReport } from '@acme/app/server';
import {
  loadGuardianWards,
  loadSummaryBySession,
  markGuardianViewed,
  resolveCaptureCrop,
} from '@/lib/summary.repository';
import { printReportHtml, type PrintableMode } from '@/lib/printable-homework';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const mode = request.nextUrl.searchParams.get('mode');
  if (mode !== 'report' && mode !== 'practice') {
    return NextResponse.json({ error: 'Invalid print mode' }, { status: 400 });
  }
  if (!sessionId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const report = await guardianSummaryReport(auth, request.headers, sessionId, {
      loadGuardianWards,
      loadSummary: loadSummaryBySession,
      markGuardianViewed,
      resolveCaptureCrop,
    });
    if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const html = printReportHtml(report, mode as PrintableMode);
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
      },
    });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json(
      { error: message === 'Unauthenticated' ? 'Unauthenticated' : 'Report unavailable' },
      { status: message === 'Unauthenticated' ? 401 : 500 },
    );
  }
}
