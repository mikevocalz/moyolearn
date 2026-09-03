// Next.js proxy — enforces real Better Auth sessions on learner surfaces.
//
// This proxy runs on the Node.js runtime by default in Next 16, so the dynamic
// import is the remaining load-bearing piece: the `!== 'live'` check below is a
// runtime guard, but a static import is evaluated when the module loads, so in
// mock mode the app still paid the cost of loading an auth stack it had already
// decided not to use.
// SOT: docs/pack/06-auth-onboarding-spec.md §7
// SOT-KEYWORDS: proxy auth session redirect login protected operation
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  '/login',
  '/api/auth',
  '/admin',
  '/api/payload',
  '/payload-api',
  '/_next',
  '/favicon.ico',
  /*
    `/api/marketing` is anonymous BY DESIGN and was being 307'd to `/login` in
    production, which is a redirect the marketing site reads as a CORS failure
    — Natalie went silent on www.moyolearn.com with a green deploy log. The
    surface behind it holds no learner data and takes no learner id: the
    marketing baked pieces are the approved public clips enumerated in
    `packages/voice/src/baked.ts`, served as signed, TTL'd CDN reads. Its own
    route sets the CORS headers, and those headers cannot be reached from
    behind a session gate.
  */
  '/api/marketing',
];

export async function proxy(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_AUTH_MODE !== 'live') return NextResponse.next();

  const isPublic = PUBLIC_PATHS.some((prefix) =>
    request.nextUrl.pathname === prefix || request.nextUrl.pathname.startsWith(`${prefix}/`),
  );
  if (isPublic) return NextResponse.next();

  /*
    AN API ROUTE ANSWERS WITH A STATUS, NOT WITH A LOGIN PAGE.

    Redirecting `/api/*` to `/login` is invisible to `fetch`, which follows the
    307 and hands the caller a 200 full of HTML. The tutor stream then reads
    zero SSE frames and lands in `retry` — "I couldn't reach Natalie just then"
    — so a signed-out child is told the tutor is broken and offered a button
    that cannot ever work. 401 is the difference between "we are down" and
    "sign in", and only the client can draw that distinction.
  */
  const unauthenticated = () =>
    request.nextUrl.pathname.startsWith('/api/')
      ? NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', request.url));

  try {
    const { auth } = await import('@/lib/auth');
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return unauthenticated();
  } catch {
    // Fail closed: if the session check errors, treat it as no session.
    return unauthenticated();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
