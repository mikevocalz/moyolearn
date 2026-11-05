/**
 * HTTP client for Moyo's Better Auth server and app API, as a native client.
 *
 * Contract (verified against https://app.moyolearn.com on 2026-11-04 with a
 * deliberately invalid sign-in): requests carry `Origin: moyo://`, the one
 * non-web origin in `trustedOrigins` (packages/auth/src/server.ts on main);
 * an untrusted origin gets 403, a bad password 401 INVALID_EMAIL_OR_PASSWORD.
 * Cookies are handled by hand (cookies.ts): `credentials: "omit"` stops
 * NSURLSession storing them. Each request takes a snapshot from the cookie jar
 * (cookie-jar.ts) and hands its response's Set-Cookie back with that
 * snapshot's generation; the jar merges it into the current cookie, or drops
 * it when a sign-out happened while the request was in flight.
 * Error bodies are surfaced by `code` only; no header, cookie or body is logged.
 * SOT: docs/desktop/seams/D04.md
 * SOT-KEYWORDS: desktop auth client better-auth fetch origin cookie entitlements organization
 */
import type { SubscriptionState } from "../../../../packages/auth/src/entitlements.ts";
import type { CookieJar } from "./cookie-jar";
import { mergeSetCookie } from "./cookies.ts";
import type { MemberRow } from "./roles";

/** Same origin mobile ships to (apps/mobile/eas.json EXPO_PUBLIC_AUTH_URL). */
export const AUTH_ORIGIN = "https://app.moyolearn.com";
const NATIVE_ORIGIN = "moyo://";

export class AuthHttpError extends Error {
  // Plain fields, not constructor parameter properties: Node's type stripping
  // (scripts/*.test.mjs) rejects parameter properties.
  readonly status: number;
  readonly code: string | null;
  constructor(status: number, code: string | null, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** The network was unreachable; distinct from a server answer. */
export class AuthOfflineError extends Error {}

export interface SessionUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  /** Better Auth `user.guardianManaged` additional field: true for learner accounts. */
  readonly guardianManaged?: boolean;
}

export function createAuthClient(cookies: Pick<CookieJar, "read" | "persist">) {
  async function request(path: string, init: { method?: "GET" | "POST"; body?: object } = {}): Promise<unknown> {
    const { cookie, generation } = await cookies.read();
    const headers: Record<string, string> = { Origin: NATIVE_ORIGIN, Accept: "application/json" };
    if (cookie) headers.Cookie = cookie;
    if (init.body) headers["Content-Type"] = "application/json";
    let response: Response;
    try {
      response = await fetch(`${AUTH_ORIGIN}${path}`, {
        method: init.method ?? "GET",
        headers,
        credentials: "omit",
        body: init.body ? JSON.stringify(init.body) : undefined,
      });
    } catch {
      throw new AuthOfflineError("Moyo Learn could not reach app.moyolearn.com.");
    }
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) await cookies.persist(generation, (current) => mergeSetCookie(current, setCookie));
    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    if (!response.ok) {
      const record = body !== null && typeof body === "object" ? (body as Record<string, unknown>) : {};
      const code = typeof record.code === "string" ? record.code : null;
      const message = typeof record.message === "string" ? record.message : `Request failed (${response.status})`;
      throw new AuthHttpError(response.status, code, message);
    }
    return body;
  }

  return {
    signInEmail: (email: string, password: string) =>
      request("/api/auth/sign-in/email", { method: "POST", body: { email, password, rememberMe: true } }),
    async getSession(): Promise<SessionUser | null> {
      const body = await request("/api/auth/get-session");
      if (body === null || typeof body !== "object") return null;
      const user = (body as { user?: Partial<SessionUser> }).user;
      if (!user || typeof user.id !== "string") return null;
      return {
        id: user.id,
        name: typeof user.name === "string" ? user.name : "",
        email: typeof user.email === "string" ? user.email : "",
        guardianManaged: user.guardianManaged === true,
      };
    },
    signOut: () => request("/api/auth/sign-out", { method: "POST", body: {} }),
    async listOrganizations(): Promise<{ id: string; name: string }[]> {
      const body = await request("/api/auth/organization/list");
      return Array.isArray(body)
        ? body.filter((o): o is { id: string; name: string } => typeof o?.id === "string" && typeof o?.name === "string")
        : [];
    },
    async organizationMembers(organizationId: string): Promise<MemberRow[]> {
      const body = await request(`/api/auth/organization/get-full-organization?organizationId=${encodeURIComponent(organizationId)}`);
      const members = (body as { members?: unknown } | null)?.members;
      return Array.isArray(members) ? (members as MemberRow[]) : [];
    },
    async entitlements(): Promise<SubscriptionState[]> {
      const body = (await request("/api/entitlements")) as { subscriptions?: unknown } | null;
      return Array.isArray(body?.subscriptions) ? (body.subscriptions as SubscriptionState[]) : [];
    },
  };
}

export type AuthClient = ReturnType<typeof createAuthClient>;
