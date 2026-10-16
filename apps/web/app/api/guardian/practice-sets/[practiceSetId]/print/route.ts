// GET /api/guardian/practice-sets/[practiceSetId]/print?mode=sheet|key
// Browser Print -> Save as PDF, with the report print route's headers: no
// cache, no index, no framing, no outbound anything. A draft answers 409; the
// adult approves what they read before it can print.
// SOT: docs/work/pr-100/contract.md §Routes §Practice sets · apps/web/app/api/guardian/reports/[sessionId]/print/route.ts
// SOT-KEYWORDS: practice set print route html sheet key headers csp guardian
import { NextRequest, NextResponse } from 'next/server';
import {
  PracticeSetNotApproved,
  practiceSetForPrint,
} from '@acme/app/features/homework/practice.service.ts';
import { practiceSheetHtml } from '@acme/app/features/homework/practice-sheet-html.ts';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';
import { practiceErrorStatus, practicePorts } from '../../_ports';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ practiceSetId: string }> },
) {
  const { practiceSetId } = await params;
  const mode = request.nextUrl.searchParams.get('mode');
  if (mode !== 'sheet' && mode !== 'key') {
    return NextResponse.json({ error: 'Invalid print mode' }, { status: 400 });
  }
  if (!practiceSetId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const set = await practiceSetForPrint(auth, request.headers, practiceSetId, practicePorts);
    if (!set) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return new NextResponse(practiceSheetHtml(set, mode, { toolbar: true }), {
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
    if (error instanceof PracticeSetNotApproved) {
      return NextResponse.json({ error: 'not-approved' }, { status: 409 });
    }
    if (error instanceof Error) reportRouteError(error);
    const { status, error: message } = practiceErrorStatus(error instanceof Error ? error.message : '');
    return NextResponse.json({ error: message }, { status });
  }
}
