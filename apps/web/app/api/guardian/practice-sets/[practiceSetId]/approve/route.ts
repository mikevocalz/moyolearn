// POST /api/guardian/practice-sets/[practiceSetId]/approve -> approved PracticeSetView.
// Approving twice returns the approved set; it is a statement, not a counter.
// SOT: docs/work/pr-100/contract.md §Routes §Practice sets
// SOT-KEYWORDS: practice set route approve guardian
import { NextRequest, NextResponse } from 'next/server';
import { approvePracticeSetFor } from '@acme/app/features/homework/practice.service.ts';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';
import { practiceErrorStatus, practicePorts } from '../../_ports';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ practiceSetId: string }> },
) {
  const { practiceSetId } = await params;
  if (!practiceSetId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const set = await approvePracticeSetFor(auth, request.headers, practiceSetId, practicePorts);
    if (!set) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(set, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const { status, error: message } = practiceErrorStatus(error instanceof Error ? error.message : '');
    return NextResponse.json({ error: message }, { status });
  }
}
