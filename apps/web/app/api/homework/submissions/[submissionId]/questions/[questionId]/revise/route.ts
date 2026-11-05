import { NextRequest, NextResponse } from 'next/server';
import { reviseHomeworkQuestion } from '@acme/app/server';
import { auth } from '@/lib/auth';
import { homeworkError, homeworkPorts, readJson } from '../../../../../_shared';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ submissionId: string; questionId: string }> },
) {
  try {
    const { submissionId, questionId } = await params;
    const body = await readJson(request);
    return NextResponse.json(
      await reviseHomeworkQuestion(auth, request.headers, submissionId, questionId, body, homeworkPorts),
    );
  } catch (error) {
    return homeworkError(error);
  }
}
