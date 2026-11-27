// The session credential a client request to the Moyo API carries, decided in
// one place.
//
// On web the session is an httpOnly cookie the browser attaches itself, so
// `credentials: 'include'` is the whole story and this answers with no headers.
// On native it is not: `@better-auth/expo` keeps the session cookie in
// SecureStore and sends its own requests with `credentials: 'omit'` plus a
// `cookie` header read from that store, so the platform cookie jar never holds
// it. A plain `fetch` from the app therefore reaches `apps/web/proxy.ts` with no
// session and is refused 401 before the route runs. The native fork of
// `providers/session/session-cookie` hands this module the auth client's
// `getCookie()`; web hands it null.
//
// THE COOKIE GOES ONLY TO THE CONFIGURED API ORIGIN. It is a bearer credential,
// so a request built against any other absolute URL — or a base that is not
// absolute, which on native means nothing was configured — gets no header
// rather than a guess.
// SOT: packages/auth/src/expo-plugin.native.ts · packages/app/core/api-url.ts
// SOT-KEYWORDS: api session cookie native secure store better auth expo fetch header origin

import { API_URL } from './api-url.ts';

/** What the native Better Auth client exposes; web has no source at all. */
export interface SessionCookieSource {
  readonly getCookie: () => Promise<string>;
}

function sameOrigin(url: string, base: string): boolean {
  if (!base) return false;
  try {
    return new URL(url).origin === new URL(base).origin;
  } catch {
    return false;
  }
}

/**
 * Headers that carry the stored session to `url`, or none.
 *
 * A failed SecureStore read is answered with no header, not a throw: the
 * request then meets the server's own 401, which the caller already turns into
 * an honest message, instead of failing in a way no screen has copy for.
 */
export async function sessionHeaders(
  url: string,
  source: SessionCookieSource | null,
  base: string = API_URL,
): Promise<Record<string, string>> {
  if (!source || !sameOrigin(url, base)) return {};
  try {
    const cookie = await source.getCookie();
    return cookie ? { cookie } : {};
  } catch {
    return {};
  }
}
