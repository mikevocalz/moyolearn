// ConsentFlow v1 — verifiable parental consent, as a machine rather than a screen
// (doc 06 §3.1 · §8 PR-14).
//
// The methods here are the ones the amended COPPA Rule approves and that doc 06
// §1 says our architecture qualifies for: **email-plus** as the default,
// **text-plus** as the alternative — permissible ONLY because children's data is
// never disclosed to third parties — **KBA** behind a "having trouble?" fallback,
// and **card** for families who reach billing anyway. Face-match is deliberately
// not built in v1: highest friction, and we do not need it.
//
// It lives in @acme/auth and holds no IO because the rule it enforces is legal,
// not visual: the "plus" in email-plus/text-plus is a SECOND, separate contact
// after the first one is verified, and a flow that let a screen skip it would
// produce a consent record that does not mean what it says. Sending is the
// caller's job; deciding whether consent was obtained is this file's.
// SOT: docs/pack/06-auth-onboarding-spec.md §1 · §3.1 · §8
// SOT-KEYWORDS: consent flow coppa verifiable parental email-plus text-plus kba card evidence

import type { ConsentMethod } from './create-learner.ts';

/** What the guardian is being told we collect, and why. Rendered, never retyped. */
export interface ConsentDisclosure {
  what: string;
  why: string;
}

/**
 * The notice, as data. Doc 06 §3.1 has ConsentFlow render from the consent
 * schema so the words a guardian agreed to are the words in the record — a
 * hand-written screen drifts from the policy the version number refers to.
 */
export const CONSENT_DISCLOSURES: ConsentDisclosure[] = [
  {
    what: 'What your child types, says, and uploads while working with the tutor',
    why: 'So the tutor can help with the actual problem in front of them.',
  },
  {
    what: 'What they get right and wrong, and which skills that points at',
    why: 'So the work adapts instead of repeating what they already know.',
  },
  {
    what: 'A first name, a username, and their date of birth',
    why: 'So we can address them, sign them in, and apply the right protections.',
  },
];

/** The two promises the streamlined tier rests on — stated, because they are load-bearing. */
export const CONSENT_PROMISES = [
  'We never sell your child’s data.',
  'We never train AI on your child’s conversations.',
] as const;

export interface ConsentEnvironment {
  /**
   * Whether the product discloses children's data to third parties. Text-plus is
   * approved ONLY where it does not (doc 06 §1). It is a parameter rather than a
   * constant so the day someone adds a disclosure, the method turns itself off
   * instead of quietly staying legal-looking.
   */
  disclosesToThirdParties: boolean;
  /** True once the guardian has a card on file — the classic method, already paid for. */
  hasVerifiedCard: boolean;
}

export const DEFAULT_CONSENT_ENVIRONMENT: ConsentEnvironment = {
  disclosesToThirdParties: false,
  hasVerifiedCard: false,
};

export function availableMethods(env: ConsentEnvironment): ConsentMethod[] {
  const methods: ConsentMethod[] = ['email-plus'];
  if (!env.disclosesToThirdParties) methods.push('text-plus');
  if (env.hasVerifiedCard) methods.push('card');
  // KBA is always reachable, but as the fallback doc 06 §3.1 puts behind
  // "having trouble?" — it is the highest-friction path, not a first offer.
  methods.push('kba');
  return methods;
}

export const isFallbackMethod = (method: ConsentMethod) => method === 'kba';

/** One KBA question. Four options, one right — the dynamic multiple-choice form the Rule names. */
export interface KbaQuestion {
  id: string;
  prompt: string;
  options: string[];
  answerIndex: number;
}

/**
 * Enough questions that guessing does not pass, and a threshold below 100% so a
 * guardian who mistypes one address is not locked out of their own child's
 * account. Four questions, three correct: a 1-in-256 guess against a 1-in-4
 * chance per question.
 */
export const KBA_QUESTION_COUNT = 4;
export const KBA_PASS_MARK = 3;

/**
 * A code is worth exactly as much as its limits. Six digits with unlimited tries
 * is a four-minute brute force, and one that never expires is a code sitting in
 * an inbox a year later — so both live here, next to the method they protect,
 * rather than in whichever screen happens to send it.
 */
export const CODE_TTL_MINUTES = 15;
export const MAX_CODE_ATTEMPTS = 5;

export interface ConsentChallenge {
  method: ConsentMethod;
  /** Where the code went — an email address or a phone number, never the child's. */
  sentTo: string;
  /** When the code was issued; `CODE_TTL_MINUTES` from here it is dead. */
  sentAt: string;
  /** Wrong guesses so far. At `MAX_CODE_ATTEMPTS` the challenge is burnt. */
  attempts: number;
  /** The first contact is verified; the "plus" step has not happened yet. */
  codeVerified: boolean;
  /** The second, separate contact — what makes email-plus more than email. */
  confirmed: boolean;
  /** KBA only: the ids of the set that was asked, so the same set cannot be retried. */
  askedIds: string[];
  /** KBA only: how many were answered correctly. */
  correct: number;
  /** Failed sets, so a guardian cannot grind the same four questions. */
  spentIds: string[][];
}

export function startChallenge(
  method: ConsentMethod,
  sentTo: string,
  env: ConsentEnvironment = DEFAULT_CONSENT_ENVIRONMENT,
  now: Date = new Date(),
): { ok: true; challenge: ConsentChallenge } | { ok: false; reason: string } {
  if (!availableMethods(env).includes(method)) {
    return {
      ok: false,
      reason:
        method === 'text-plus'
          ? 'Text-plus consent is only available while we disclose nothing to third parties.'
          : `${method} consent is not available for this account.`,
    };
  }
  if ((method === 'email-plus' || method === 'text-plus') && !sentTo.trim()) {
    return { ok: false, reason: 'We need somewhere to send the code.' };
  }
  return {
    ok: true,
    challenge: {
      method,
      sentTo: sentTo.trim(),
      sentAt: now.toISOString(),
      attempts: 0,
      codeVerified: false,
      confirmed: false,
      askedIds: [],
      correct: 0,
      spentIds: [],
    },
  };
}

export type CodeVerdict = 'verified' | 'wrong' | 'expired' | 'burnt';

/**
 * `matched` is the channel's answer to "is this the code we sent" — comparing it
 * is the channel's job because only the channel knows what it issued. Whether a
 * match still COUNTS is this function's: an expired or burnt challenge refuses a
 * correct code, which is the whole point of having limits.
 */
export function verifyCode(
  challenge: ConsentChallenge,
  matched: boolean,
  now: Date = new Date(),
): { challenge: ConsentChallenge; verdict: CodeVerdict } {
  if (challenge.attempts >= MAX_CODE_ATTEMPTS) return { challenge, verdict: 'burnt' };
  if (isCodeExpired(challenge, now)) return { challenge, verdict: 'expired' };
  if (matched) return { challenge: { ...challenge, codeVerified: true }, verdict: 'verified' };
  const attempts = challenge.attempts + 1;
  return {
    challenge: { ...challenge, attempts },
    verdict: attempts >= MAX_CODE_ATTEMPTS ? 'burnt' : 'wrong',
  };
}

export function isCodeExpired(challenge: ConsentChallenge, now: Date = new Date()): boolean {
  const sent = new Date(challenge.sentAt).getTime();
  if (Number.isNaN(sent)) return true;
  return now.getTime() - sent > CODE_TTL_MINUTES * 60_000;
}

/**
 * The "plus". Refused before the code is verified, because a confirmation that
 * did not follow a verified first contact is just one contact wearing a hat.
 */
export function confirm(challenge: ConsentChallenge): ConsentChallenge {
  return challenge.codeVerified ? { ...challenge, confirmed: true } : challenge;
}

/**
 * Score a KBA set. A set that fails is SPENT: the Rule's test is questions a
 * child in the household could not reasonably ascertain, and a set that can be
 * re-answered is one a child can brute-force from the same four screens.
 */
/** Order-independent identity for a KBA set — see `scoreKba`. */
const spentKey = (ids: readonly string[]): string => [...ids].sort().join('\u0000');

export function scoreKba(
  challenge: ConsentChallenge,
  questions: KbaQuestion[],
  answers: number[],
): ConsentChallenge {
  /*
    A SET, COMPARED AS A SET. `spentIds` stored the ids in PRESENTATION order
    and compared them the same way, so re-serving the same four questions
    shuffled produced a different `join()`, missed the spent check and scored
    normally — with the correct answers already known from the failed attempt.
    Two passes over four screens is exactly the brute-force this function's own
    docstring says a spent set exists to prevent, and it granted `confirmed`.
  */
  const ids = questions.map((q) => q.id);
  const key = spentKey(ids);
  if (challenge.spentIds.some((set) => spentKey(set) === key)) {
    return { ...challenge, askedIds: ids, correct: 0 };
  }
  const correct = questions.reduce(
    (total, question, i) => total + (answers[i] === question.answerIndex ? 1 : 0),
    0,
  );
  const passed = correct >= KBA_PASS_MARK && questions.length >= KBA_QUESTION_COUNT;
  return {
    ...challenge,
    askedIds: ids,
    correct,
    codeVerified: passed,
    // KBA is a single act of verification, not a two-contact method: passing the
    // set IS the confirmation, and there is no second channel to confirm on.
    confirmed: passed,
    spentIds: passed ? challenge.spentIds : [...challenge.spentIds, ids],
  };
}

export const isChallengeComplete = (challenge: ConsentChallenge) =>
  challenge.codeVerified && challenge.confirmed;

export interface ConsentRecord {
  method: ConsentMethod;
  scope: string;
  policyVersion: string;
  /** What we can show a regulator: which channel, which act, when. */
  evidenceRef: string;
  verifiedAt: string;
}

/**
 * The record, or a refusal. Never a partial: doc 06 §2 forbids a child account
 * without a consent behind it, so a half-finished challenge has to fail here
 * rather than produce something `validateConsent` will wave through.
 */
export function completeConsent(
  challenge: ConsentChallenge,
  input: { scope: string; policyVersion: string; now?: Date },
): { ok: true; record: ConsentRecord } | { ok: false; reason: string } {
  if (!challenge.codeVerified) {
    return { ok: false, reason: 'That code has not been verified yet.' };
  }
  if (!challenge.confirmed) {
    return {
      ok: false,
      reason: 'We still need the second confirmation — check for our follow-up message.',
    };
  }
  if (!input.scope.trim()) return { ok: false, reason: 'Consent needs a scope.' };
  if (!input.policyVersion.trim()) return { ok: false, reason: 'Consent needs a policy version.' };

  const verifiedAt = (input.now ?? new Date()).toISOString();
  return {
    ok: true,
    record: {
      method: challenge.method,
      scope: input.scope,
      policyVersion: input.policyVersion,
      evidenceRef: evidenceRef(challenge, verifiedAt),
      verifiedAt,
    },
  };
}

/**
 * `validateConsent` requires an evidence reference for every method except
 * email-plus, so one is minted for all of them — email-plus included. Costing
 * nothing and being there is better than the audit where it is the one record
 * that cannot say how consent was obtained.
 */
function evidenceRef(challenge: ConsentChallenge, verifiedAt: string): string {
  const stamp = verifiedAt.replace(/[-:.TZ]/g, '').slice(0, 14);
  if (challenge.method === 'kba') return `kba:${challenge.askedIds.join('+')}:${stamp}`;
  if (challenge.method === 'card') return `card:${challenge.sentTo}:${stamp}`;
  return `${challenge.method}:${redact(challenge.sentTo)}:${stamp}`;
}

/** The evidence names the channel, not the whole address — it outlives the session. */
function redact(target: string): string {
  const [local, domain] = target.split('@');
  if (domain) return `${(local ?? '').slice(0, 2)}***@${domain}`;
  return `***${target.slice(-4)}`;
}

/**
 * The version a new consent is recorded against. It lives HERE, next to
 * `needsReconsent`, because the two are one decision: bumping this is what makes
 * §6's re-consent fire, and a copy of it in a screen is a copy that can disagree
 * with the function that reads it.
 */
export const CONSENT_POLICY_VERSION = '2026-08-01';

/**
 * Doc 06 §6: consent records are immutable and versioned, and a material change
 * re-consents. Comparing versions rather than dates is what makes that true —
 * a record is never edited, a new one is written against the new version.
 */
export const needsReconsent = (record: ConsentRecord, currentPolicyVersion: string) =>
  record.policyVersion !== currentPolicyVersion;
