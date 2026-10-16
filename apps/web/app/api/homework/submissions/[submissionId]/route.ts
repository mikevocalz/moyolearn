import { NextRequest, NextResponse } from 'next/server';
import { homeworkSubmission } from '@acme/app/server';
import { auth } from '@/lib/auth';
import { homeworkError, homeworkPorts } from '../../_shared';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ submissionId: string }> }) {
  try {
    const { submissionId } = await params;
    return NextResponse.json(await homeworkSubmission(auth, request.headers, submissionId, homeworkPorts));
  } catch (error) {
    return homeworkError(error);
  }
}
