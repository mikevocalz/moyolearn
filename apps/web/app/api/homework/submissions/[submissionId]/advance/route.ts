import { NextRequest, NextResponse } from 'next/server';
import { advanceHomeworkSubmission } from '@acme/app/server';
import { auth } from '@/lib/auth';
import { homeworkError, homeworkPorts, readJson } from '../../../_shared';

export const dynamic = 'force-dynamic';

/**
 * 200 with the new cursor, or 409 `{ error: 'stale-cursor', current }` when
 * another device moved first. The client reconciles to `current`; nothing was
 * written for the losing request.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ submissionId: string }> }) {
  try {
    const { submissionId } = await params;
    const body = await readJson(request);
    const outcome = await advanceHomeworkSubmission(auth, request.headers, submissionId, body, homeworkPorts);
    if (outcome.kind === 'stale') {
      return NextResponse.json({ error: 'stale-cursor', current: outcome.current }, { status: 409 });
    }
    return NextResponse.json(outcome.result);
  } catch (error) {
    return homeworkError(error);
  }
}
