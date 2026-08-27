// GET /api/tutor/session — the authenticated learner's live conversation.
//
// Resolve-or-create, in one call. A separate "start" endpoint would leave a
// device that crashed between the two with a tutor stage and no thread behind
// it, and the child would open the app to a conversation they know they had and
// find it empty.
//
// `?problem=` is a CREATION argument only. A request that names a problem for a
// session that already exists is answered with the existing thread unchanged —
// the alternative lets a reload silently rewrite what the session was about.
// SOT: CLAUDE.md §The block · docs/pack/23-tutorstage-handoff.md
// SOT-KEYWORDS: tutor session api route resume cross-device protected operation open create
import { NextRequest, NextResponse } from 'next/server';
import { openSession } from '@acme/app/server';
import { createSession, loadOpenSession } from '@/lib/tutor-session.repository';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const problem = request.nextUrl.searchParams.get('problem') ?? undefined;

  try {
    const session = await openSession(
      auth,
      request.headers,
      { problem },
      loadOpenSession,
      createSession,
    );
    return NextResponse.json({ ok: true, session });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthenticated' ? 401 : 500 });
  }
}
