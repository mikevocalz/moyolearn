// Which onboarding sequence a person gets, keyed by the role they already are.
//
// The key IS `RoleKind` rather than a parallel vocabulary: the session already
// knows what someone is, so `/onboarding/${persona.kind}` is the whole routing
// decision and there is no second table to keep in sync. Doc 06 §5 numbers the
// sequences S21–S25; the map below is that table and nothing else.
// SOT: docs/pack/06-auth-onboarding-spec.md §5
// SOT-KEYWORDS: onboarding flow route rolekind s21 s22 s23 s24 s25 slug

import type { RoleKind } from '../../../providers/session/types.ts';

export type OnboardingFlow = RoleKind;

export const ONBOARDING_FLOWS: Record<OnboardingFlow, { screen: string; title: string }> = {
  guardian: { screen: 'S21', title: 'Set up your family' },
  learner: { screen: 'S22', title: 'Welcome' },
  tutor: { screen: 'S23', title: 'Set up your tutoring profile' },
  owner: { screen: 'S24', title: 'Set up your business' },
  teacher: { screen: 'S25', title: 'Set up your class' },
  staff: { screen: 'S26', title: 'Set up your staff profile' },
  school_admin: { screen: 'S27', title: 'Set up your school' },
  district_admin: { screen: 'S28', title: 'Set up your district' },
};

export function isOnboardingFlow(value: string | undefined): value is OnboardingFlow {
  return value !== undefined && value in ONBOARDING_FLOWS;
}

/** Where a role's onboarding lives. The only place this path is spelled. */
export const onboardingPath = (flow: OnboardingFlow) => `/onboarding/${flow}` as const;
