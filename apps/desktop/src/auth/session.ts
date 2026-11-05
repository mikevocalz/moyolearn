/**
 * Desktop session lifecycle: restore, sign in, refresh on focus, sign out.
 *
 * The Better Auth session cookie is the only secret. It lives in the macOS
 * Keychain through `@legendapp/spark/secure-storage` (generic password,
 * project-scoped service, AfterFirstUnlockThisDeviceOnly; RNDesktopSecureStorage.mm)
 * and in this module's memory for the life of the process. It never enters the
 * Zustand store, `@legendapp/spark/settings`, a log line or an error message.
 *
 * Writes go through cookie-jar.ts: sign-out and a server-ended session bump
 * its generation, so a request already in flight cannot write the cookie back.
 *
 * Roles come from the server's organization member rows (roles.ts), the same
 * resolution mobile uses. Learner accounts (`guardianManaged`) are signed out
 * on desktop: the learner shell arrives only through a guardian handoff code
 * (PR pack §PR-D04), which ships with the first learner surface in PR-D05.
 * SOT: docs/desktop/seams/D04.md · docs/38-front-door-and-flow.md
 * SOT-KEYWORDS: desktop auth session keychain secure-storage sign-in sign-out refresh roles
 */
import { deleteItemAsync, getItemAsync, setItemAsync } from "@legendapp/spark/secure-storage";
import { addWindowListener } from "@legendapp/spark/windows";
import { invalidateClassrooms } from "../classrooms/requests";
import { useShellStore, type AuthNotice } from "../store";
import { AuthHttpError, AuthOfflineError, createAuthClient, type SessionUser } from "./client";
import { createCookieJar } from "./cookie-jar";
import { hasSessionToken } from "./cookies";
import { signOutEverywhere, signOutProblem } from "./sign-out";
import { memberEducationRole, workspacesFor, type RoleKind } from "./roles";

const KEYCHAIN_KEY = "moyo.session.cookie";

const jar = createCookieJar({
  get: () => getItemAsync(KEYCHAIN_KEY),
  set: (value) => setItemAsync(KEYCHAIN_KEY, value),
  delete: () => deleteItemAsync(KEYCHAIN_KEY),
});

const client = createAuthClient(jar);

/** Drops the cookie from memory and the Keychain and voids every in-flight response. */
function forgetLocalSession(): Promise<void> {
  return jar.forget();
}

function noticeFor(cause: unknown): AuthNotice {
  if (cause instanceof AuthOfflineError) return { kind: "offline" };
  if (cause instanceof AuthHttpError) {
    if (cause.code === "INVALID_EMAIL_OR_PASSWORD") return { kind: "invalid-credentials" };
    if (cause.code === "EMAIL_NOT_VERIFIED") return { kind: "verify-email" };
    return { kind: "error", message: cause.message };
  }
  return { kind: "error", message: cause instanceof Error ? cause.message : String(cause) };
}

async function educationRoles(user: SessionUser): Promise<{ roles: RoleKind[]; organizations: { id: string; name: string }[] }> {
  const organizations = await client.listOrganizations();
  const members = await Promise.all(organizations.map((org) => client.organizationMembers(org.id)));
  const roles = members.flatMap((rows) => {
    const member = rows.find((row) => (row.userId ?? row.user?.id) === user.id);
    return member ? [memberEducationRole(member)] : [];
  });
  return { roles, organizations };
}

async function loadPlan(): Promise<void> {
  const store = useShellStore.getState();
  store.setPlan({ status: "loading" });
  try {
    store.setPlan({ status: "ready", subscriptions: await client.entitlements() });
  } catch (cause) {
    const message =
      cause instanceof AuthOfflineError
        ? cause.message
        : cause instanceof Error
          ? cause.message
          : String(cause);
    useShellStore.getState().setPlan({ status: "failed", message });
  }
}

/**
 * Lifecycle generation. Restore, sign-in, sign-out and focus checks each take a
 * number; a slower operation finishing after a newer one has started applies
 * nothing, so a late restore can't overwrite a sign-in and a focus check that
 * returns after Sign Out can't report "session ended".
 */
let generation = 0;
const begin = () => ++generation;
const current = (ticket: number) => ticket === generation;

/** Server sign-out, then the Keychain copy whatever the server said. Never throws. */
function signOutBothSides() {
  return signOutEverywhere({ server: () => client.signOut(), forgetLocal: forgetLocalSession });
}

function signedOut(ticket: number, notice: AuthNotice | null): void {
  if (!current(ticket)) return;
  // Classroom reads made for this session must not land in the next one.
  invalidateClassrooms();
  const store = useShellStore.getState();
  store.setSessionRoles([]);
  store.setPlan({ status: "idle" });
  store.setAuth({ status: "signed-out", notice });
}

/** Turns a server-confirmed user into the signed-in state, or refuses a learner account. */
async function adopt(ticket: number, user: SessionUser): Promise<void> {
  if (user.guardianManaged) {
    const outcome = await signOutBothSides();
    signedOut(ticket, { kind: "learner-on-desktop" });
    // A failed server sign-out leaves only a server session that expires on
    // its own; a Keychain entry left behind would restore it next launch.
    if (!outcome.keychain.ok) useShellStore.getState().reportError("Sign Out", outcome.keychain.cause);
    return;
  }
  const { roles, organizations } = await educationRoles(user);
  if (!current(ticket)) return;
  const store = useShellStore.getState();
  store.setSessionRoles(workspacesFor(roles).filter((role) => role !== "learner"));
  store.setAuth({ status: "signed-in", account: { id: user.id, name: user.name, email: user.email, organizations } });
  void loadPlan();
}

/** Launch: validate any stored cookie with the server before showing a signed-in shell. */
export async function restoreSession(): Promise<void> {
  const ticket = begin();
  useShellStore.getState().setAuth({ status: "checking" });
  try {
    const { cookie: stored } = await jar.read();
    if (!hasSessionToken(stored)) {
      // Leftover Better Auth cookies without a session token can't sign
      // anyone in; clear them so the next request doesn't replay them.
      if (stored !== null) {
        await forgetLocalSession().catch((cause) => useShellStore.getState().reportError("Keychain", cause));
      }
      signedOut(ticket, null);
      return;
    }
    const user = await client.getSession();
    if (!user) {
      if (current(ticket)) await forgetLocalSession();
      signedOut(ticket, { kind: "session-ended" });
      return;
    }
    await adopt(ticket, user);
  } catch (cause) {
    // Offline or a server error at launch keeps the Keychain copy: the
    // session may be valid, and the next launch or sign-in retries.
    signedOut(ticket, noticeFor(cause));
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  const ticket = begin();
  useShellStore.getState().setAuth({ status: "signing-in" });
  try {
    await client.signInEmail(email.trim(), password);
    const user = await client.getSession();
    if (!user) throw new Error("The server accepted the sign-in but returned no session.");
    await adopt(ticket, user);
  } catch (cause) {
    // A sign-in that fails after the server issued a cookie (for example the
    // organization lookup) must not leave that cookie behind a signed-out UI.
    if (current(ticket)) await forgetLocalSession().catch(() => undefined);
    signedOut(ticket, noticeFor(cause));
  }
}

export async function signOut(): Promise<void> {
  const ticket = begin();
  const problem = signOutProblem(await signOutBothSides());
  signedOut(ticket, null);
  if (problem) useShellStore.getState().reportError("Sign Out", new Error(problem));
}

/** The signed-in client for feature reads (Classrooms). Same cookie, same origin. */
export const sessionClient = client;

/** Called when a feature read gets 401: the server no longer honours the cookie. */
export async function endSession(): Promise<void> {
  const ticket = begin();
  invalidateClassrooms();
  await forgetLocalSession().catch(() => undefined);
  signedOut(ticket, { kind: "session-ended" });
}

/** Re-checks the session whenever the main window gains focus (revoked elsewhere, expired). */
export function watchSessionOnFocus(): () => void {
  let stopped = false;
  let remove: (() => Promise<void>) | undefined;
  addWindowListener("main", "focusChanged", (event) => {
    if (!event.focused || useShellStore.getState().auth.status !== "signed-in") return;
    const ticket = generation;
    client
      .getSession()
      .then(async (user) => {
        if (user || !current(ticket)) return;
        await forgetLocalSession();
        signedOut(ticket, { kind: "session-ended" });
      })
      .catch((cause) => {
        // Offline on focus keeps the session: the cookie may still be valid.
        if (!(cause instanceof AuthOfflineError)) useShellStore.getState().reportError("Session check", cause);
      });
  })
    .then((registration) => {
      if (stopped) void registration.remove();
      else remove = () => registration.remove();
    })
    .catch((cause) => useShellStore.getState().reportError("Session check", cause));
  return () => {
    stopped = true;
    remove?.().catch((cause) => useShellStore.getState().reportError("Session check", cause));
  };
}
