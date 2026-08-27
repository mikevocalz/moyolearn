// POST /api/learner/profile — persists the onboarding band to the learner record.
// SOT: docs/pack/06-auth-onboarding-spec.md §5 · docs/pack/07-security-child-ai-safety-spec.md §3
// SOT-KEYWORDS: learner profile api route grade band onboarding protected operation
import { NextRequest, NextResponse } from 'next/server';
import { saveLearnerProfile } from '@acme/app/server';
import { saveGradeBand } from '@/lib/student-model.repository';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // The band is a policy register, so an unrecognised value is rejected rather
  // than coerced — a typo must not quietly select the adult crisis script.
  const gradeBand = (body as { gradeBand?: unknown })?.gradeBand;
  if (gradeBand !== 'young' && gradeBand !== 'older') {
    return NextResponse.json({ error: 'gradeBand must be young or older' }, { status: 400 });
  }

  try {
    await saveLearnerProfile(auth, request.headers, { gradeBand }, saveGradeBand);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthenticated' ? 401 : 500 });
  }
}
