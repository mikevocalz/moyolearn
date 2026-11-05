// One error map for every homework route, so a 403 and a 404 cannot drift
// apart between handlers. Shape follows `api/tutor/next`: Unauthenticated 401,
// Forbidden and unknown id are both 404, bad body 400, id owned by another learner 409.
// Anything else is reported and answered 500.
// SOT: docs/work/pr-100/contract.md §Routes · apps/web/app/api/tutor/next/route.ts
// SOT-KEYWORDS: homework route error mapping unauthenticated forbidden not found conflict
import { NextResponse } from 'next/server';
import { HomeworkConflict, HomeworkInputInvalid, HomeworkNotFound } from '@acme/app/server';
import { reportRouteError } from '@/lib/report-error';
import {
  advanceSubmission,
  createSubmission,
  issueHomeworkEvidence,
  listSubmissions,
  loadSubmissionForLearner,
  loadSubmissionOwner,
  reviseQuestion,
  startSubmission,
} from '@/lib/homework.repository';
import { loadGuardianWards } from '@/lib/summary.repository';

export const homeworkPorts = {
  loadGuardianWards,
  loadSubmissionOwner,
  createSubmission,
  loadSubmission: loadSubmissionForLearner,
  listSubmissions,
  reviseQuestion,
  startSubmission,
  advanceSubmission,
  issueEvidence: issueHomeworkEvidence,
};

/** Unparseable JSON is a bad body, not a server error. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HomeworkInputInvalid('body is not JSON');
  }
}

export function homeworkError(error: unknown): NextResponse {
  if (error instanceof HomeworkNotFound) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (error instanceof HomeworkInputInvalid) return NextResponse.json({ error: error.message }, { status: 400 });
  if (error instanceof HomeworkConflict) return NextResponse.json({ error: 'submission-conflict' }, { status: 409 });
  const message = error instanceof Error ? error.message : 'Server error';
  if (message === 'Unauthenticated') return NextResponse.json({ error: message }, { status: 401 });
  // Same answer as an unknown id, as the guardian report routes give: a 403
  // would confirm that another family's submission id exists.
  if (message === 'Forbidden') return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (error instanceof Error) reportRouteError(error);
  return NextResponse.json({ error: 'Server error' }, { status: 500 });
}
