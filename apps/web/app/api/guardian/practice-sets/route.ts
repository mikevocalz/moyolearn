// POST /api/guardian/practice-sets { submissionId } -> draft PracticeSetView.
// The caller is the guardian on the session; the body names a submission and
// nothing about who is asking.
// SOT: docs/work/pr-100/contract.md §Routes §Practice sets
// SOT-KEYWORDS: practice set route draft create guardian submission
import { NextRequest, NextResponse } from 'next/server';
import { draftPracticeSet } from '@acme/app/features/homework/practice.service.ts';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';
import { practiceErrorStatus, practicePorts } from './_ports';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { submissionId?: unknown } | null;
  const submissionId = typeof body?.submissionId === 'string' ? body.submissionId.trim() : '';
  if (!submissionId) return NextResponse.json({ error: 'submissionId required' }, { status: 400 });

  try {
    const set = await draftPracticeSet(auth, request.headers, submissionId, practicePorts);
    if (!set) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(set, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const { status, error: message } = practiceErrorStatus(error instanceof Error ? error.message : '');
    return NextResponse.json({ error: message }, { status });
  }
}
