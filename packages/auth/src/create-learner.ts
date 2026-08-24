// The guardian→child creation path. Doc 06 §2 specifies one server action:
// create the learner user (username credential) → write the guardianship →
// write the consent record → apply the restricted-account flags.
// Doing it in four steps in a screen would let a learner exist without consent.
// SOT: docs/pack/06-auth-onboarding-spec.md §2 §6
// SOT-KEYWORDS: learner guardian create consent coppa username restricted server-action

export type ConsentMethod = 'email-plus' | 'text-plus' | 'kba' | 'card';

export interface CreateLearnerInput {
  guardianAuthId: string;
  username: string;
  password: string;
  displayName: string;
  consent: { method: ConsentMethod; scope: string; policyVersion: string; evidenceRef?: string };
}

/**
 * A learner username is a credential, not a handle: doc 06 §2 requires it be
 * non-identifying by policy, so anything that looks like an email or a full
 * name is refused at the door rather than nudged in the UI.
 */
export function validateLearnerUsername(username: string): { ok: true } | { ok: false; reason: string } {
  if (username.length < 3 || username.length > 30) {
    return { ok: false, reason: 'A username is between 3 and 30 characters.' };
  }
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(username)) {
    return { ok: false, reason: 'Letters, numbers, dots, dashes and underscores only.' };
  }
  if (username.includes('@')) {
    return { ok: false, reason: 'A learner username is never an email address.' };
  }
  return { ok: true };
}

/** Doc 06 §6: guardian-set passwords get guidance, not composition theatre. */
export function validateLearnerPassword(password: string): { ok: true } | { ok: false; reason: string } {
  if (password.length < 12) {
    return { ok: false, reason: 'Twelve characters or more — length beats symbols.' };
  }
  return { ok: true };
}

/**
 * Consent must be complete *before* the learner row exists, so this is checked
 * first and the whole action refuses rather than creating an unconsented child.
 */
export function validateConsent(consent: CreateLearnerInput['consent']): { ok: true } | { ok: false; reason: string } {
  if (!consent.scope.trim()) return { ok: false, reason: 'Consent needs a scope.' };
  if (!consent.policyVersion.trim()) {
    return { ok: false, reason: 'Consent records are versioned (doc 06 §6).' };
  }
  if (consent.method !== 'email-plus' && !consent.evidenceRef) {
    return { ok: false, reason: `The ${consent.method} method must carry an evidence reference.` };
  }
  return { ok: true };
}

/**
 * Doc 06 §2 says a learner account carries no email. Better Auth's user table
 * makes `email` required AND unique, so "no email" cannot be expressed as null —
 * something has to occupy the column.
 *
 * This is that something: an opaque id under the RFC 2606 `.invalid` TLD, which
 * is guaranteed never to resolve. It is derived from a random id and never from
 * the child's name or username, so it identifies nobody; nothing is ever
 * delivered to it; password reset for these accounts runs through the guardian
 * (§2), never through this address; and `isRestrictedLearnerUpdate` already
 * refuses any attempt to change it to a real one.
 */
export function learnerPlaceholderEmail(opaqueId: string): string {
  return `${opaqueId}@learners.invalid`;
}

export function isPlaceholderEmail(email: string): boolean {
  return email.endsWith('@learners.invalid');
}

export function validateCreateLearner(
  input: CreateLearnerInput,
): { ok: true } | { ok: false; reason: string } {
  // Consent first: a learner that exists without it is the failure this whole
  // spec is written to prevent.
  const consent = validateConsent(input.consent);
  if (!consent.ok) return consent;
  const username = validateLearnerUsername(input.username);
  if (!username.ok) return username;
  return validateLearnerPassword(input.password);
}
