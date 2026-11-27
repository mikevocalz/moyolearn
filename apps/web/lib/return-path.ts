// Where sign-in sends someone back to — a same-origin path, or nothing.
//
// The proxy bounces a signed-out browser to `/login`, and that bounce used to
// drop the address it interrupted: a guardian who opened an incident mail's
// `/alerts` link signed in and landed on `/tutor`, with the alert they came for
// one screen away and nothing saying so. The proxy now carries the interrupted
// path as `?next=`, and the login form sends the reader back to it.
//
// `next` IS CLIENT INPUT, so this is an open-redirect gate first and a
// convenience second. It accepts only a path this app serves: one leading `/`,
// never `//` or `/\` (both read as a protocol-relative URL to a browser), no
// backslash or control character anywhere, and — resolved against a sentinel
// origin — still on that origin. Anything else is `null`, and the caller keeps
// its ordinary destination. `/login` itself and `/api/*` are refused too: the
// first is a loop, the second answers JSON rather than a page.
//
// No `server-only`: the proxy, the login route and the client form all read it,
// and it touches no environment.
// SOT: apps/web/proxy.ts · apps/web/components/auth/LoginContent.tsx
// SOT-KEYWORDS: return path next redirect login sign-in open redirect same origin alerts callback

const SENTINEL = 'https://return-path.invalid';

/** The query parameter the proxy writes and the login route reads. */
export const RETURN_PATH_PARAM = 'next';

export function safeReturnPath(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2048) return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return null;

  let resolved: URL;
  try {
    resolved = new URL(raw, SENTINEL);
  } catch {
    return null;
  }
  if (resolved.origin !== SENTINEL) return null;

  const { pathname } = resolved;
  if (pathname === '/login' || pathname.startsWith('/login/')) return null;
  if (pathname === '/api' || pathname.startsWith('/api/')) return null;

  return `${pathname}${resolved.search}${resolved.hash}`;
}
