// Next.js middleware — enforces real Better Auth sessions on learner surfaces.
//
// Two things here are load-bearing and both were learned by the whole app
// returning 500 on every route. Middleware defaults to the EDGE runtime, where
// `node:util/types` does not exist — and Better Auth's pg/kysely stack reaches
// it — so this file must declare the nodejs runtime. And the import has to be
// dynamic: the `!== 'live'` check below is a runtime guard, but a static import
// is evaluated when the module loads, so in mock mode the app still paid the
// cost of loading an auth stack it had already decided not to use.
// SOT: docs/pack/06-auth-onboarding-spec.md §7
// SOT-KEYWORDS: middleware auth session redirect login protected operation runtime nodejs edge
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  '/login',
  '/api/auth',
  '/admin',
  '/api/payload',
  '/payload-api',
  '/_next',
  '/favicon.ico',
];

export async function middleware(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_AUTH_MODE !== 'live') return NextResponse.next();

  const isPublic = PUBLIC_PATHS.some((prefix) =>
    request.nextUrl.pathname === prefix || request.nextUrl.pathname.startsWith(`${prefix}/`),
  );
  if (isPublic) return NextResponse.next();

  try {
    const { auth } = await import('@/lib/auth');
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  } catch {
    // Fail closed: if the session check errors, send to login.
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  runtime: 'nodejs',
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
