// Next.js middleware — enforces real Better Auth sessions on learner surfaces.
// SOT: docs/pack/06-auth-onboarding-spec.md §7
// SOT-KEYWORDS: middleware auth session redirect login protected operation
import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';

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
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
