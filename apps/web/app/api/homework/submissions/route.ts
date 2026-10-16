import { NextRequest, NextResponse } from 'next/server';
import { createHomeworkSubmission, listHomeworkSubmissions } from '@acme/app/server';
import { auth } from '@/lib/auth';
import { homeworkError, homeworkPorts, readJson } from '../_shared';

export const dynamic = 'force-dynamic';

/** Create, idempotent on `submissionId`: 201 first time, 200 on a retry. */
export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    const outcome = await createHomeworkSubmission(auth, request.headers, body, homeworkPorts);
    return NextResponse.json(outcome.submission, { status: outcome.kind === 'created' ? 201 : 200 });
  } catch (error) {
    return homeworkError(error);
  }
}

/** `?learner=` names a ward; absent means the caller. Bare array, newest first. */
export async function GET(request: NextRequest) {
  try {
    const learner = request.nextUrl.searchParams.get('learner');
    const submissions = await listHomeworkSubmissions(auth, request.headers, learner, homeworkPorts);
    return NextResponse.json(submissions);
  } catch (error) {
    return homeworkError(error);
  }
}
