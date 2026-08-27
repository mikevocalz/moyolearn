import { type NextRequest, NextResponse } from 'next/server';
import { protectedOperation } from '@acme/app/server';
import { auth } from '@/lib/auth';
import { signCdnUrl } from '@/lib/bunny-token';
import { reportRouteError } from '@/lib/report-error';

// The one door to a stored media URL, now that the pull zone refuses unsigned
// reads (doc 29 §5).
//
// The session route signs its own attachments inline because it is already
// assembling them. Everything else that holds a bare CDN URL — an editor note's
// waveform, any future embed — comes through here: authenticate, sign, 302.
// A redirect rather than a proxy, so the bytes still come off Bunny's edge and
// this route costs one signature.
//
// `practise` floor on purpose: viewing media you can already see in the app is
// not a paid capability, and gating it would strand a learner's own homework.
// SOT: docs/pack/29-bunny-media-spec.md §5
// SOT-KEYWORDS: media view signed url redirect token auth cdn read door
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  const base = process.env.NEXT_PUBLIC_BUNNY_CDN_BASE_URL ?? '';

  // Only OUR zone. An open redirect that signs nothing is still an open
  // redirect; anything else 400s rather than bounces.
  if (!url || !base || !url.startsWith(base)) {
    return NextResponse.json({ error: 'Not a media URL this product serves' }, { status: 400 });
  }

  try {
    const signed = await protectedOperation(auth, request.headers, async () => signCdnUrl(url), {
      telemetry: { op: 'media.view', resource: 'media', action: 'read' },
    });
    return NextResponse.redirect(signed, { status: 302 });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthenticated' ? 401 : 500 });
  }
}
