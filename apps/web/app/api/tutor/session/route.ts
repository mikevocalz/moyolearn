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
import { signCdnUrl } from '@/lib/bunny-token';
import { budgetedGateway } from '@/lib/inference';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

export async function GET(request: NextRequest) {
  const problem = request.nextUrl.searchParams.get('problem') ?? undefined;

  try {
    const session = await openSession(
      auth,
      request.headers,
      { problem },
      loadOpenSession,
      createSession,
      /*
        Passed rather than defaulted. `openSession` reads `budgetState` to decide
        whether the composer opens, and the answer has to come from the same
        Postgres row the coaching turn debits — a gateway defaulted here would
        read the process-local fallback and tell a child their day was fresh
        after a deploy that had already spent it.
      */
      budgetedGateway(),
    );
    /*
      SIGNED AT READ TIME, per doc 29 §5. The stored url is canonical and
      unsigned; the pull zone now refuses unsigned reads, so every attachment is
      re-signed here with a one-hour window. Signing on write instead would bake
      an expiry into the database and strand the other device an hour later.
    */
    return NextResponse.json({
      ok: true,
      session: {
        ...session,
        messages: session.messages.map((message) => ({
          ...message,
          attachments: message.attachments.map((attachment) =>
            attachment.url !== undefined
              ? { ...attachment, url: signCdnUrl(attachment.url) }
              : attachment,
          ),
        })),
      },
    });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthenticated' ? 401 : 500 });
  }
}
