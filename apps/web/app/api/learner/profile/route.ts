// POST /api/learner/profile — persists the onboarding band to the learner record.
// GET reads it back for the live session bootstrap: the band is server-injected
// (doc 07 §3 layer 1), so the client's only lawful copy is the one served here.
// SOT: docs/pack/06-auth-onboarding-spec.md §5 · docs/pack/07-security-child-ai-safety-spec.md §3
// SOT-KEYWORDS: learner profile api route grade band onboarding protected operation
import { NextRequest, NextResponse } from 'next/server';
import { saveLearnerProfile, loadLearnerProfile, VOICE_BANDS, type VoiceBand } from '@acme/app/server';
import { saveGradeBand, loadGradeBand } from '@/lib/student-model.repository';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

export async function GET(request: NextRequest) {
  try {
    const profile = await loadLearnerProfile(auth, request.headers, loadGradeBand);
    return NextResponse.json(profile);
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthenticated' ? 401 : 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  /*
    Rejected rather than coerced. `asVoiceBand` exists and would happily turn a
    typo into 9-12, but a fallback is for a value the server READ and could not
    understand; this one is a value a client SENT, and silently rewriting it is
    how a nine-year-old ends up in the wrong register with a 200 in the log.
  */
  const gradeBand = (body as { gradeBand?: unknown })?.gradeBand;
  if (typeof gradeBand !== 'string' || !(VOICE_BANDS as readonly string[]).includes(gradeBand)) {
    return NextResponse.json(
      { error: `gradeBand must be one of ${VOICE_BANDS.join(', ')}` },
      { status: 400 },
    );
  }

  try {
    await saveLearnerProfile(auth, request.headers, { gradeBand: gradeBand as VoiceBand }, saveGradeBand);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthenticated' ? 401 : 500 });
  }
}
