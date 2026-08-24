// S21 guardian onboarding — the step machine, kept out of the component so the
// ordering rules are testable. Doc 06 §5 fixes the sequence; the gates below are
// what stop a guardian reaching "add children" without a consent behind them.
// SOT: docs/pack/06-auth-onboarding-spec.md §5
// SOT-KEYWORDS: onboarding guardian s21 steps sequence consent children gate

import {
  validateCreateLearner,
  validateLearnerPassword,
  validateLearnerUsername,
  type ConsentMethod,
  type ConsentRecord,
} from '@acme/auth';

export const GUARDIAN_STEPS = ['welcome', 'account', 'consent', 'children', 'grants'] as const;
export type GuardianStep = (typeof GUARDIAN_STEPS)[number];

export interface ChildDraft {
  displayName: string;
  username: string;
  password: string;
  dob: string;
}

export interface GuardianDraft {
  email: string;
  consentMethod: ConsentMethod | null;
  consentAccepted: boolean;
  /**
   * The verified record from ConsentFlow, not a checkbox. Until PR-14 this step
   * accepted a tick and wrote `email-plus` beside it, which named a method
   * nobody had performed — the evidence reference in here is the difference
   * between a consent record and a claim.
   */
  consentRecord: ConsentRecord | null;
  children: ChildDraft[];
}

export const EMPTY_DRAFT: GuardianDraft = {
  email: '',
  consentAccepted: false,
  consentMethod: null,
  consentRecord: null,
  children: [],
};

/** H5 (error prevention): the Next affordance is disabled, not the error explained after the fact. */
export function canAdvance(step: GuardianStep, draft: GuardianDraft): boolean {
  switch (step) {
    case 'welcome':
      return true;
    case 'account':
      return /.+@.+\..+/.test(draft.email);
    case 'consent':
      // Consent gates everything after it — doc 06 §2 forbids a child existing
      // without one, and the only way to guarantee that here is to refuse to
      // move on. A finished VERIFICATION, not an accepted notice: reading the
      // notice is the first half, and the half that has no legal weight alone.
      return draft.consentRecord !== null;
    case 'children':
      return draft.children.length > 0 && draft.children.every((c) => isChildComplete(c, draft));
    case 'grants':
      return true;
  }
}

/**
 * Per-field, not one lump message. Kit's onboarding validates each password rule
 * live as you type; a single "this one still needs..." string makes the guardian
 * re-read every rule to find the one they broke (H9).
 */
export interface ChildProblems {
  displayName?: string;
  username?: string;
  password?: string;
  dob?: string;
}

export function childProblems(child: ChildDraft): ChildProblems {
  const problems: ChildProblems = {};
  if (!child.displayName.trim()) problems.displayName = 'Give them a name the tutor can use.';
  const username = validateLearnerUsername(child.username);
  if (!username.ok) problems.username = username.reason;
  const password = validateLearnerPassword(child.password);
  if (!password.ok) problems.password = password.reason;
  if (!isValidDob(child.dob)) problems.dob = 'Use YYYY-MM-DD.';
  return problems;
}

export function isChildComplete(child: ChildDraft, draft: GuardianDraft): boolean {
  if (!draft.consentRecord) return false;
  if (Object.keys(childProblems(child)).length > 0) return false;
  return validateCreateLearner({
    guardianAuthId: 'pending',
    username: child.username,
    password: child.password,
    displayName: child.displayName,
    consent: draft.consentRecord,
  }).ok;
}

export function isValidDob(dob: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return false;
  const d = new Date(dob);
  return !Number.isNaN(d.getTime()) && d < new Date();
}

/**
 * Doc 06 §5 cites Khan's DOB-first regime selection, and §2 splits the account
 * model at 13. The band is derived from DOB rather than asked, so a guardian
 * cannot pick the looser regime by mistake.
 */
export function consentRegime(dob: string, now: Date = new Date()): 'under-13' | 'teen' | 'unknown' {
  if (!isValidDob(dob)) return 'unknown';
  const born = new Date(dob);
  let age = now.getFullYear() - born.getFullYear();
  const before =
    now.getMonth() < born.getMonth() ||
    (now.getMonth() === born.getMonth() && now.getDate() < born.getDate());
  if (before) age -= 1;
  return age < 13 ? 'under-13' : 'teen';
}

/** Bumping this is what makes doc 06 §6's re-consent fire. */
export const CONSENT_POLICY_VERSION = '2026-08-01';

export function nextStep(step: GuardianStep): GuardianStep | null {
  const i = GUARDIAN_STEPS.indexOf(step);
  return GUARDIAN_STEPS[i + 1] ?? null;
}

/** H3 (user control): every step except the first goes back, always. */
export function previousStep(step: GuardianStep): GuardianStep | null {
  const i = GUARDIAN_STEPS.indexOf(step);
  return i > 0 ? GUARDIAN_STEPS[i - 1]! : null;
}

export function stepProgress(step: GuardianStep): { index: number; total: number } {
  return { index: GUARDIAN_STEPS.indexOf(step) + 1, total: GUARDIAN_STEPS.length };
}
