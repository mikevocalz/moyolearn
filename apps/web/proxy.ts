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
  /*
    THE BYPASS IS OPT-IN, NOT A DEFAULT.

    This read used to be `!== 'live'`, which made an UNSET variable mean "open
    every protected route". That is the wrong way round for a gate, and on
    2026-09-22 it was measured doing exactly what it says: a Vercel preview of
    this app builds with no environment at all — the project has zero
    Preview-scoped variables — and `NEXT_PUBLIC_*` is inlined at BUILD time, so
    the check evaluated against `undefined` and the proxy waved everything
    through. `/tutor` served 200 instead of redirecting, and
    `/api/account/learners/delete` answered 405 rather than 401, which is the
    route reporting a wrong method — i.e. the request had already passed the
    gate and reached the handler. One `vercel promote` away from shipping that
    to app.moyolearn.com.

    The condition is now the same one `isMockAuth()` uses in
    `packages/app/core/protected-operation.ts`: explicit mock AND a development
    build. Restated here rather than imported on purpose — this file's whole
    shape is about not loading server modules it might not need (see the
    dynamic import below), and the definition is two env reads. If that
    condition ever changes, it changes in both places.

    On Vercel every build is NODE_ENV=production, previews included, so a
    preview now fails CLOSED: it redirects to /login and is useless for testing
    a signed-in flow, which is the correct trade against being unauthenticated.
  */
  const mockAuth =
    process.env.NEXT_PUBLIC_AUTH_MODE === 'mock' && process.env.NODE_ENV === 'development';
  if (mockAuth) return NextResponse.next();

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
  } catch (error) {
    /*
      Fail closed: if the session check errors, treat it as no session. That
      part is correct and stays — a gate that opens when it cannot answer is
      not a gate.

      What was missing is the record. A broken `@/lib/auth` import, an expired
      database credential and a genuinely signed-out visitor all produced the
      same silent 307 to `/login`, so a total auth outage was indistinguishable
      in production logs from ordinary traffic. Nobody would page on it; the
      graph would just show everyone suddenly choosing to sign in again.
    */
    const errorClass = error instanceof Error ? error.name : typeof error;
    console.error(
      `[proxy] session check failed on ${request.nextUrl.pathname}: ${errorClass}`,
      error,
    );
    return unauthenticated();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
