// S24 business-owner onboarding — the step machine. Doc 06 §5: org live and a
// first real booking inside day one, via org create → import students/families →
// invite tutors → embedded Stripe Merchant onboarding → milestone checklist
// pinned in the rail.
//
// Only the org step is gated. Everything after it is a milestone, and a
// milestone that blocks the flow is just a gate with better PR — doc 05 §2.3
// wants the business ACTIVATED, which means letting them reach the checklist and
// come back to whichever row they can finish today.
// SOT: docs/pack/06-auth-onboarding-spec.md §5
// SOT-KEYWORDS: onboarding business s24 org import invite payments milestones steps

import type { RosterImport } from './roster-csv.ts';
import { EMPTY_ACTIVATION, type ActivationState } from './milestones.ts';

export const BUSINESS_STEPS = ['org', 'import', 'invite', 'payments', 'checklist'] as const;
export type BusinessStep = (typeof BUSINESS_STEPS)[number];

export interface BusinessDraft {
  orgName: string;
  locations: string[];
  services: string[];
  /** Null until a file has been read; holds the mapper's verdict, not the file. */
  roster: RosterImport | null;
  tutorEmails: string[];
  activation: ActivationState;
}

export const SERVICES = [
  '1:1 tutoring',
  'Small group',
  'Test prep',
  'Homework club',
  'Online only',
] as const;

export const EMPTY_BUSINESS_DRAFT: BusinessDraft = {
  orgName: '',
  locations: [],
  services: [],
  roster: null,
  tutorEmails: [],
  activation: EMPTY_ACTIVATION,
};

export function canAdvance(step: BusinessStep, draft: BusinessDraft): boolean {
  switch (step) {
    case 'org':
      // The org is the only thing the rest of the flow cannot be written without.
      return draft.orgName.trim().length > 0 && draft.services.length > 0;
    case 'import':
    case 'invite':
    case 'payments':
    case 'checklist':
      return true;
  }
}

export function toggleService(services: string[], value: string): string[] {
  return services.includes(value) ? services.filter((s) => s !== value) : [...services, value];
}

/** Emails typed or pasted as a block — operators paste from their own list. */
export function parseInvitees(text: string): string[] {
  const seen = new Set<string>();
  return text
    .split(/[\s,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /.+@.+\..+/.test(s))
    .filter((s) => (seen.has(s) ? false : (seen.add(s), true)));
}

export function nextStep(step: BusinessStep): BusinessStep | null {
  const i = BUSINESS_STEPS.indexOf(step);
  return BUSINESS_STEPS[i + 1] ?? null;
}

export function previousStep(step: BusinessStep): BusinessStep | null {
  const i = BUSINESS_STEPS.indexOf(step);
  return i > 0 ? BUSINESS_STEPS[i - 1]! : null;
}

export function stepProgress(step: BusinessStep): { index: number; total: number } {
  return { index: BUSINESS_STEPS.indexOf(step) + 1, total: BUSINESS_STEPS.length };
}

/**
 * Todoist puts "Skip for now" under Continue as its own full-width button, which
 * is the honest shape when skipping is genuinely allowed. `null` means the step
 * has no skip — the label doubles as the answer to "can I".
 */
export const SKIP_LABEL: Record<BusinessStep, string | null> = {
  org: null,
  import: 'I’ll import later',
  invite: 'I’ll invite them later',
  payments: 'Set up payments later',
  checklist: null,
};
