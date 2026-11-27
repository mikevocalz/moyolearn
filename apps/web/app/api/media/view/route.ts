import { type NextRequest, NextResponse } from 'next/server';
import { MediaNotFound, signOwnedMediaUrl } from '@acme/app/server';
import { loadGuardianWards } from '@/lib/summary.repository';
import { auth } from '@/lib/auth';
import { signCdnUrl } from '@/lib/bunny-token';
import { mediaPrefix } from '@/lib/bunny.repository';
import { reportRouteError } from '@/lib/report-error';

// The one door to a stored media URL, now that the pull zone refuses unsigned
// reads (doc 29 §5).
//
// The session route signs its own attachments inline because it is already
// assembling them. Everything else that holds a bare CDN URL — an editor note's
// waveform, any future embed — comes through here: authenticate, PROVE THE
// CALLER MAY SEE IT, sign, 302. A redirect rather than a proxy, so the bytes
// still come off Bunny's edge and this route costs one signature.
//
// Ownership is the service's question (`signOwnedMediaUrl`): the key names its
// owner, and the caller must be that learner, that org, or an active guardian
// of that learner. A miss is 404, the same answer as a URL outside the zone,
// so the route confirms nothing about objects it will not serve.
//
// `practise` floor on purpose: viewing media you can already see in the app is
// not a paid capability, and gating it would strand a learner's own homework.
// SOT: docs/pack/29-bunny-media-spec.md §5 · packages/app/features/media/media-access.service.ts
// SOT-KEYWORDS: media view signed url redirect token auth cdn read door ownership ward
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
    const signed = await signOwnedMediaUrl(auth, request.headers, url, {
      loadGuardianWards,
      sign: signCdnUrl,
      cdnBase: base,
      mediaPrefix: mediaPrefix(),
    });
    return NextResponse.redirect(signed, { status: 302 });
  } catch (error) {
    if (error instanceof MediaNotFound) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (error instanceof Error && error.message === 'Unauthenticated') {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }
    if (error instanceof Error) reportRouteError(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
