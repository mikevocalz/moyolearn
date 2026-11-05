// Cookie-jar and role-mapping tests for src/auth/cookies.ts and src/auth/roles.ts.
// SOT-KEYWORDS: desktop auth test cookie role mapping
import { test } from "node:test";
import assert from "node:assert/strict";
import { hasSessionToken, mergeSetCookie, splitSetCookie } from "../src/auth/cookies.ts";
import { WORKSPACE_FOR_ROLE, memberEducationRole, workspacesFor } from "../src/auth/roles.ts";

const signIn =
  "__Secure-better-auth.session_token=abc.def; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax, " +
  "tracking=1; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Path=/";

test("splits joined Set-Cookie without breaking Expires dates", () => {
  assert.deepEqual(splitSetCookie(signIn).length, 2);
  assert.match(splitSetCookie(signIn)[1], /Expires=Wed, 21 Oct 2026/);
});

test("keeps only Better Auth cookies", () => {
  assert.equal(mergeSetCookie(null, signIn), "__Secure-better-auth.session_token=abc.def");
  assert.equal(hasSessionToken("__Secure-better-auth.session_token=abc.def"), true);
  assert.equal(hasSessionToken("tracking=1"), false);
});

test("a refreshed token replaces the stored one", () => {
  const next = mergeSetCookie("better-auth.session_token=old", "better-auth.session_token=new; Max-Age=60");
  assert.equal(next, "better-auth.session_token=new");
});

test("sign-out deletion empties the jar", () => {
  assert.equal(mergeSetCookie("better-auth.session_token=old", "better-auth.session_token=; Max-Age=0; Path=/"), null);
});

test("no Set-Cookie leaves the jar unchanged", () => {
  assert.equal(mergeSetCookie("better-auth.session_token=x", null), "better-auth.session_token=x");
});

test("educationRole wins over the organisation role", () => {
  assert.equal(memberEducationRole({ role: "owner", educationRole: "teacher" }), "teacher");
  assert.equal(memberEducationRole({ role: "manager" }), "staff");
  assert.equal(memberEducationRole({ role: "unknown-role" }), "guardian");
  assert.equal(memberEducationRole({ educationRole: "not-a-role", role: "finance" }), "staff");
});

test("roles collapse onto the five desktop workspaces", () => {
  assert.deepEqual(workspacesFor([]), ["guardian"]);
  assert.deepEqual(workspacesFor(["teacher", "tutor"]), ["tutor"]);
  assert.deepEqual(workspacesFor(["district_admin", "guardian", "staff"]), ["guardian", "org", "district"]);
  assert.equal(WORKSPACE_FOR_ROLE.school_admin, "org");
});

// Drift guard: the desktop tables restate main's. Read main's sources and compare.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MEMBERSHIP_ROLES, ORGANIZATION_TO_EDUCATION, ROLE_KINDS } from "../src/auth/roles.ts";

const repo = (path) => readFileSync(fileURLToPath(new URL(`../../../${path}`, import.meta.url)), "utf8");
const quoted = (text) => [...text.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

test("ROLE_KINDS and the organisation map match packages/app/providers/session/role-mapping.ts", () => {
  const source = repo("packages/app/providers/session/role-mapping.ts");
  const kinds = source.match(/ROLE_KINDS[^=]*=\s*\[([\s\S]*?)\]/);
  assert.ok(kinds, "ROLE_KINDS not found");
  assert.deepEqual(quoted(kinds[1]), [...ROLE_KINDS]);
  const map = source.match(/DEFAULT_ORGANIZATION_TO_EDUCATION[^=]*=\s*\{([\s\S]*?)\}/);
  assert.ok(map, "DEFAULT_ORGANIZATION_TO_EDUCATION not found");
  const entries = Object.fromEntries([...map[1].matchAll(/(\w+):\s*'([a-z_]+)'/g)].map((m) => [m[1], m[2]]));
  assert.deepEqual(entries, { ...ORGANIZATION_TO_EDUCATION });
});

test("MEMBERSHIP_ROLES match packages/auth/src/membership.ts", () => {
  const source = repo("packages/auth/src/membership.ts");
  const roles = source.match(/MEMBERSHIP_ROLES\s*=\s*\[([^\]]*)\]/);
  assert.ok(roles, "MEMBERSHIP_ROLES not found");
  assert.deepEqual(quoted(roles[1]), [...MEMBERSHIP_ROLES]);
});

// Cookie jar and client: late responses after sign-out, parallel Set-Cookie,
// and sign-out reporting (src/auth/cookie-jar.ts, client.ts, sign-out.ts).
import { createCookieJar } from "../src/auth/cookie-jar.ts";
import { AuthOfflineError, createAuthClient } from "../src/auth/client.ts";
import { signOutEverywhere, signOutProblem } from "../src/auth/sign-out.ts";

function memorySlot(initial = null) {
  const slot = {
    value: initial,
    writes: [],
    async get() {
      return slot.value;
    },
    async set(value) {
      slot.writes.push(["set", value]);
      slot.value = value;
    },
    async delete() {
      slot.writes.push(["delete"]);
      slot.value = null;
    },
  };
  return slot;
}

/** Replaces fetch with one that answers each call when the test says so. */
function controlledFetch() {
  const pending = [];
  const original = globalThis.fetch;
  globalThis.fetch = (url, init) =>
    new Promise((resolve) => pending.push({ url: String(url), init, answer: (setCookie, body = {}) =>
      resolve(new Response(JSON.stringify(body), { status: 200, headers: setCookie ? { "set-cookie": setCookie } : {} })) }));
  return { pending, restore: () => (globalThis.fetch = original) };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

test("a response that lands after forget() does not write the cookie back", async () => {
  const slot = memorySlot("better-auth.session_token=old");
  const jar = createCookieJar(slot);
  const { generation } = await jar.read();
  await jar.forget();
  const wrote = await jar.persist(generation, () => "better-auth.session_token=late");
  assert.equal(wrote, false);
  assert.equal(slot.value, null);
  assert.equal((await jar.read()).cookie, null);
});

test("a late sign-in response through the client stays out of the Keychain after sign-out", async () => {
  const slot = memorySlot(null);
  const jar = createCookieJar(slot);
  const client = createAuthClient(jar);
  const net = controlledFetch();
  try {
    const signIn = client.signInEmail("a@example.invalid", "pw");
    while (net.pending.length < 1) await tick();
    await jar.forget();
    net.pending[0].answer("better-auth.session_token=issued; Max-Age=600; Path=/");
    await signIn;
    assert.equal(slot.value, null);
    assert.equal((await jar.read()).cookie, null);
  } finally {
    net.restore();
  }
});

test("parallel responses both land: Set-Cookie merges into the current cookie, not the request's snapshot", async () => {
  const slot = memorySlot("better-auth.session_token=t");
  const jar = createCookieJar(slot);
  const client = createAuthClient(jar);
  const net = controlledFetch();
  try {
    const a = client.organizationMembers("org-a");
    const b = client.organizationMembers("org-b");
    while (net.pending.length < 2) await tick();
    net.pending[0].answer("better-auth.session_data=one; Max-Age=300", { members: [] });
    await a;
    net.pending[1].answer("better-auth.dont_remember=two; Max-Age=300", { members: [] });
    await b;
    const { cookie } = await jar.read();
    assert.equal(cookie, "better-auth.session_token=t; better-auth.session_data=one; better-auth.dont_remember=two");
    assert.equal(slot.value, cookie);
  } finally {
    net.restore();
  }
});

test("a Keychain failure during sign-out is reported beside the server error, not instead of it", async () => {
  const outcome = await signOutEverywhere({
    server: async () => {
      throw new AuthOfflineError("Moyo Learn could not reach app.moyolearn.com.");
    },
    forgetLocal: async () => {
      throw new Error("errSecInteractionNotAllowed");
    },
  });
  assert.equal(outcome.server.ok, false);
  assert.ok(outcome.server.cause instanceof AuthOfflineError);
  assert.equal(outcome.keychain.ok, false);
  const message = signOutProblem(outcome);
  assert.match(message, /signed out on this Mac/);
  assert.match(message, /may still be active/);
  assert.match(message, /errSecInteractionNotAllowed/);
});

test("offline sign-out says the server session may still be active; a clean sign-out says nothing", () => {
  const offline = signOutProblem({ server: { ok: false, cause: new AuthOfflineError("x") }, keychain: { ok: true } });
  assert.equal(offline, "You’re signed out on this Mac, but Moyo Learn couldn’t reach app.moyolearn.com, so your session there may still be active.");
  assert.equal(signOutProblem({ server: { ok: true }, keychain: { ok: true } }), null);
});
