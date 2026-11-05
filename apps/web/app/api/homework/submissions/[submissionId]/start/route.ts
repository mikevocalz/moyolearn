import { NextRequest, NextResponse } from 'next/server';
import { startHomeworkSubmission } from '@acme/app/server';
import { auth } from '@/lib/auth';
import { homeworkError, homeworkPorts, readJson } from '../../../_shared';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ submissionId: string }> }) {
  try {
    const { submissionId } = await params;
    const body = await readJson(request);
    return NextResponse.json(await startHomeworkSubmission(auth, request.headers, submissionId, body, homeworkPorts));
  } catch (error) {
    return homeworkError(error);
  }
}
