// GET /api/share/report/[token] — doc 34 §5's teacher share view: blocks
// 1–6 + 8, problems accordion included, home support swapped for a classroom
// context line. Moyo-branded, read-only, revocable, expiring.
//
// THE ONE DOOR WITH NO SESSION BEHIND IT, on purpose: a teacher has no Moyo
// account, and the guardian-minted token IS the authorization. The service
// verifies the secret by hash against the row and answers every failure —
// wrong secret, revoked, expired, suppressed, never existed — with the same
// null, so this door is not an oracle. The view carries no learner id and no
// name; what a guardian shares is the work, not the identity.
//
// CROPS ARE SIGNED HERE, directly, because the usual `/api/media/view` door
// authenticates a session this reader does not have. The share token already
// proved the guardian's consent for exactly this content, so the route mints
// the one-hour CDN signature itself — the same signer, a different consent
// chain.
// SOT: docs/pack/34-session-summary-reports.md §3 §5 · docs/pack/29-bunny-media-spec.md §5
// SOT-KEYWORDS: teacher share read api route token hash public no session sign crop classroom context
import { NextRequest, NextResponse } from 'next/server';
import { sharedSummaryView } from '@acme/app/server';
import { loadSummaryBySession, resolveCaptureCrop } from '@/lib/summary.repository';
import { signCdnUrl } from '@/lib/bunny-token';
import { reportRouteError } from '@/lib/report-error';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const view = await sharedSummaryView(token, {
      loadSummary: loadSummaryBySession,
      resolveCaptureCrop: async (messageId, attachmentId) => {
        const url = await resolveCaptureCrop(messageId, attachmentId);
        return url === null ? null : signCdnUrl(url);
      },
    });
    if (view === null) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, report: view });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
