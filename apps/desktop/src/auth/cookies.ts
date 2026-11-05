/**
 * Better Auth session cookies for a client with no cookie jar.
 *
 * React Native macOS sends and stores no cookies unless `withCredentials` is
 * set (react-native-macos RCTNetworking.mm:320), and the auth client sends
 * `credentials: "omit"`. So the desktop app reads `Set-Cookie` itself, keeps the
 * `better-auth.*` cookies (with or without the `__Secure-` prefix that HTTPS
 * adds), and replays them as one `Cookie` header, the same contract
 * `@better-auth/expo/client` follows on mobile. The header string lives in the
 * macOS Keychain (session.ts), never in the Zustand store or logs.
 * Pure (type-only imports) so scripts/auth.test.mjs can load it under Node.
 * SOT: docs/desktop/seams/D04.md
 * SOT-KEYWORDS: desktop auth cookie set-cookie better-auth session header
 */

const AUTH_COOKIE = /^(?:__Secure-)?better-auth\.[A-Za-z0-9_.-]+$/;

/**
 * NSHTTPURLResponse joins repeated Set-Cookie headers with ", ". Split only on
 * a comma that starts a new `name=` pair, since `Expires` dates contain commas.
 */
export function splitSetCookie(header: string): string[] {
  return header
    .split(/,\s*(?=[^;,=\s]+=)/)
    .map((part) => part.trim())
    .filter(Boolean);
}

type Parsed = { name: string; value: string; deleted: boolean };

function parse(setCookie: string): Parsed | null {
  const [pair, ...attributes] = setCookie.split(";");
  const index = pair.indexOf("=");
  if (index <= 0) return null;
  const name = pair.slice(0, index).trim();
  const value = pair.slice(index + 1).trim();
  const maxAge = attributes.map((a) => a.trim().toLowerCase()).find((a) => a.startsWith("max-age="));
  const deleted = value === "" || (maxAge !== undefined && Number(maxAge.slice("max-age=".length)) <= 0);
  return { name, value, deleted };
}

function read(cookieHeader: string | null): Map<string, string> {
  const jar = new Map<string, string>();
  for (const pair of (cookieHeader ?? "").split(";")) {
    const index = pair.indexOf("=");
    if (index <= 0) continue;
    jar.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
  }
  return jar;
}

/**
 * Applies a response's Set-Cookie header to the stored Cookie header.
 * Returns the new header, or null when no Better Auth cookie remains.
 */
export function mergeSetCookie(cookieHeader: string | null, setCookieHeader: string | null): string | null {
  const jar = read(cookieHeader);
  for (const raw of setCookieHeader ? splitSetCookie(setCookieHeader) : []) {
    const cookie = parse(raw);
    if (!cookie || !AUTH_COOKIE.test(cookie.name)) continue;
    if (cookie.deleted) jar.delete(cookie.name);
    else jar.set(cookie.name, cookie.value);
  }
  const header = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
  return header || null;
}

/** True when the jar carries a session token cookie. */
export function hasSessionToken(cookieHeader: string | null): boolean {
  return [...read(cookieHeader).keys()].some((name) => /^(?:__Secure-)?better-auth\.session_token$/.test(name));
}
