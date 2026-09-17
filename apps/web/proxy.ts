// Next.js proxy — enforces real Better Auth sessions on learner surfaces.
//
// This proxy runs on the Node.js runtime by default in Next 16, so the dynamic
// import is the remaining load-bearing piece: the `!== 'live'` check below is a
// runtime guard, but a static import is evaluated when the module loads, so in
// mock mode the app still paid the cost of loading an auth stack it had already
// decided not to use.
// SOT: docs/pack/06-auth-onboarding-spec.md §7
// SOT-KEYWORDS: proxy auth session redirect login protected operation cron bearer machine route public paths
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
  /*
    Natalie's body. Ten static files with no learner data in them, copied out of
    `@acme/avatar` at build time — and behind the gate they 307'd to `/login`,
    which `GLTFLoader` reads as a corrupt glTF rather than as a redirect. Gating
    them also put a Node session check in front of 13 MB of bytes that a CDN
    should be answering on its own.
  */
  '/natalie',
  /*
    THE MACHINE DOORS. Every path below enforces its own bearer, and a bearer is
    not a session — so the gate above answered 401 before any of these handlers
    ran. It had been doing that since the routes landed: `jobs-drain` has failed
    on every scheduled run, and the daily media and retention sweeps declared in
    `vercel.json` were never running in production either. Nothing reported it,
    because `/api/health/jobs` — the dead-man switch over exactly this — was
    behind the same gate and 401'd too.

    Listed as exact paths rather than as `/api/media` and `/api/retention`,
    which also hold `presign`, `video`, `view`, `voice-note` and the manual
    sweep POSTs. Those are learner-adjacent and stay behind the session gate;
    opening a prefix to reach one cron underneath it would take them with it.

    `/api/health` is unauthenticated BY DESIGN and says so in its own header: an
    uptime prober cannot hold a secret worth having, and the body is queue
    names, booleans and machine reason strings — the repository behind it never
    selects the `data` column.
  */
  '/api/jobs',
  '/api/health',
  '/api/media/sweep/cron',
  '/api/retention/sweep/cron',
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
