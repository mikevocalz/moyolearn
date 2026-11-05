/**
 * Sign-out in two independent steps, server then Keychain, and the sentence the
 * app shows when either step fails.
 *
 * The Keychain delete runs even when the server call fails, and its own
 * failure is recorded beside the server's instead of replacing it. The user
 * is always told the truth about both: a server that was unreachable or
 * refused may still hold a live session, and a Keychain entry that could not
 * be removed would sign the next launch back in.
 * Loads under Node (scripts/auth.test.mjs); client.ts has type-only imports
 * apart from cookies.ts.
 * SOT: docs/desktop/seams/D04.md
 * SOT-KEYWORDS: desktop auth sign-out keychain offline server session copy
 */
import { AuthOfflineError } from "./client.ts";

export type StepOutcome = { readonly ok: true } | { readonly ok: false; readonly cause: unknown };

export interface SignOutOutcome {
  readonly server: StepOutcome;
  readonly keychain: StepOutcome;
}

async function step(run: () => Promise<unknown>): Promise<StepOutcome> {
  try {
    await run();
    return { ok: true };
  } catch (cause) {
    return { ok: false, cause };
  }
}

export async function signOutEverywhere(steps: {
  server: () => Promise<unknown>;
  forgetLocal: () => Promise<void>;
}): Promise<SignOutOutcome> {
  const server = await step(steps.server);
  // The local copy goes even when the server call fails; a revoked or
  // unreachable server must not leave a usable token in the Keychain.
  const keychain = await step(steps.forgetLocal);
  return { server, keychain };
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/** The banner text for a sign-out that did not fully succeed, or null. */
export function signOutProblem({ server, keychain }: SignOutOutcome): string | null {
  const parts: string[] = [];
  if (!server.ok) {
    parts.push(
      server.cause instanceof AuthOfflineError
        ? "You’re signed out on this Mac, but Moyo Learn couldn’t reach app.moyolearn.com, so your session there may still be active."
        : `You’re signed out on this Mac, but app.moyolearn.com didn’t confirm it (${messageOf(server.cause)}), so your session there may still be active.`,
    );
  }
  if (!keychain.ok) {
    parts.push(
      `The saved session couldn’t be removed from the Keychain (${messageOf(keychain.cause)}). Delete “moyo.session.cookie” in Keychain Access, or Moyo Learn may sign in again at the next launch.`,
    );
  }
  return parts.length ? parts.join(" ") : null;
}
