// Where a consent code comes from, and who says whether one matches.
//
// The machine in @acme/auth decides whether a verified code still counts (not
// expired, not burnt). It cannot decide whether the code is RIGHT, because only
// whatever issued it knows that — and issuing belongs on a server, where the
// code is never in the hands of the person being verified.
//
// So this is a port with two implementations. The LIVE channel talks to
// /api/family/consent/*, where the server mints the code, mails it, compares
// it and writes the record with the guardian taken from the session
// (consent-verification.ts; security finding H3). The DEV channel is a real
// in-memory implementation of the same four calls, not a `return true` stub:
// it mints a code, holds it, compares against it and forgets it once used, so
// a dev build still checks a real code. `createConsentChannel()` picks by auth
// mode, and a release build is live by construction (auth-mode.ts).
// SOT: docs/pack/06-auth-onboarding-spec.md §3.1
// SOT-KEYWORDS: consent channel code send verify confirm record dev live email-plus

import type { ConsentMethod } from '@acme/auth';
import { API_URL } from '../../../core/api-url.ts';
import { getAuthMode } from '../../../providers/session/auth-mode.ts';

export interface ConsentChannel {
  /** Sends a code to `target`. Resolves with the challenge once it is on its way, not when it lands. */
  send: (method: ConsentMethod, target: string) => Promise<{ challengeId: string }>;
  /** Whether `code` is the one that was sent for this challenge. Never "is this a plausible code". */
  verify: (challengeId: string, code: string) => Promise<boolean>;
  /**
   * The "plus": a SECOND contact, sent after the first is verified. Separate from
   * `send` because it is a separate message with a separate purpose, and the day
   * it becomes one call is the day someone collapses the two into one.
   */
  sendConfirmation: (challengeId: string) => Promise<void>;
  /**
   * Writes the record and answers with its id. The children step sends that id
   * and nothing else; the server reads the grant back from its own row. A KBA
   * challenge has no server row (dev only), so the id may be null there.
   */
  record: (
    challengeId: string | null,
    input: { scope: string; policyVersion: string },
  ) => Promise<{ consentId: string }>;
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
  const issued = new Map<string, { target: string; code: string }>();
  const byTarget = new Map<string, string>();
  let next = 1;

  return {
    send: async (_method, target) => {
      const challengeId = `dev-challenge-${next++}`;
      issued.set(challengeId, { target, code: mintCode(random) });
      byTarget.set(target, challengeId);
      return { challengeId };
    },
    verify: async (challengeId, code) => {
      const challenge = issued.get(challengeId);
      if (!challenge) return false;
      if (challenge.code !== code.trim()) return false;
      // One code, one use. Leaving it live means a second guardian on the same
      // device finishes a verification they never received.
      issued.delete(challengeId);
      byTarget.delete(challenge.target);
      return true;
    },
    sendConfirmation: async () => {
      // The confirming contact carries a link, not a code — there is nothing to
      // hold onto, and the guardian returning is the signal.
    },
    record: async (challengeId) => ({ consentId: `dev-consent-${challengeId ?? `kba-${next++}`}` }),
    peek: (target) => {
      const challengeId = byTarget.get(target);
      return challengeId ? issued.get(challengeId)?.code : undefined;
    },
  };
}

/** What the live routes answer with on a refusal; the message is for the screen. */
async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Could not reach Moyo. Check your connection and try again.');
  }
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) throw new Error(data?.error ?? 'Something went wrong. Try again.');
  if (!data) throw new Error('Something went wrong. Try again.');
  return data;
}

/** The server-backed channel: four routes, one guardian, taken from the session. */
export function createLiveConsentChannel(): ConsentChannel {
  return {
    send: async (method, target) => {
      const issue = await post<{ challengeId: string }>('/api/family/consent/challenge', { method, target });
      return { challengeId: issue.challengeId };
    },
    verify: async (challengeId, code) => {
      const result = await post<{ matched: boolean }>('/api/family/consent/verify', { challengeId, code });
      return result.matched;
    },
    sendConfirmation: async (challengeId) => {
      await post<{ ok: true }>('/api/family/consent/confirm', { challengeId });
    },
    record: async (challengeId, input) => {
      if (!challengeId) throw new Error('This permission method is not available here. Verify by email instead.');
      return post<{ consentId: string }>('/api/family/consent/record', { challengeId, ...input });
    },
  };
}

/** Live in live mode; the dev channel only where the session is a fixture too. */
export function createConsentChannel(): ConsentChannel {
  return getAuthMode() === 'live' ? createLiveConsentChannel() : createDevConsentChannel();
}
