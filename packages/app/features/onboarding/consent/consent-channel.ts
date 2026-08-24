// Where a consent code comes from, and who says whether one matches.
//
// The machine in @acme/auth decides whether a verified code still counts (not
// expired, not burnt). It cannot decide whether the code is RIGHT, because only
// whatever issued it knows that — and issuing belongs on a server, where the
// code is never in the hands of the person being verified.
//
// So this is a port. The dev channel below is a real implementation of it, not a
// placeholder that returns true: it mints a code, holds it, compares against it,
// and forgets it once used. That is what makes the screen honest today — it
// checks a real code — while the swap to a server-backed channel stays one
// import, with the same three methods and the same shape.
// SOT: docs/pack/06-auth-onboarding-spec.md §3.1
// SOT-KEYWORDS: consent channel code send verify confirm dev email-plus text-plus

import type { ConsentMethod } from '@acme/auth';

export interface ConsentChannel {
  /** Sends a code to `target`. Resolves when it is on its way, not when it lands. */
  send: (method: ConsentMethod, target: string) => Promise<void>;
  /** Whether `code` is the one that was sent. Never "is this a plausible code". */
  verify: (target: string, code: string) => Promise<boolean>;
  /**
   * The "plus": a SECOND contact, sent after the first is verified. Separate from
   * `send` because it is a separate message with a separate purpose, and the day
   * it becomes one call is the day someone collapses the two into one.
   */
  sendConfirmation: (method: ConsentMethod, target: string) => Promise<void>;
}

export const CODE_LENGTH = 6;

/**
 * Digits only: a code is read off one device and typed into another, often out
 * loud across a kitchen. Letters cost accuracy and buy entropy this does not
 * need — six digits against five attempts is one in two hundred thousand.
 */
function mintCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) code += Math.floor(random() * 10);
  return code;
}

export interface DevConsentChannel extends ConsentChannel {
  /**
   * Dev-only: what was "sent", so a developer can finish the flow without an
   * inbox. A server-backed channel has no equivalent and must not grow one —
   * this is the one method that would be a security hole in production.
   */
  peek: (target: string) => string | undefined;
}

/**
 * In-memory, per-session. Real enough to catch the bugs a stub hides: a wrong
 * code is refused, a code sent to one address does not verify another, and a
 * used code does not work twice.
 */
export function createDevConsentChannel(random: () => number = Math.random): DevConsentChannel {
  const issued = new Map<string, string>();

  return {
    send: async (_method, target) => {
      issued.set(target, mintCode(random));
    },
    verify: async (target, code) => {
      const expected = issued.get(target);
      if (expected === undefined) return false;
      if (expected !== code.trim()) return false;
      // One code, one use. Leaving it live means a second guardian on the same
      // device finishes a verification they never received.
      issued.delete(target);
      return true;
    },
    sendConfirmation: async () => {
      // The confirming contact carries a link, not a code — there is nothing to
      // hold onto, and the guardian returning is the signal.
    },
    peek: (target) => issued.get(target),
  };
}
