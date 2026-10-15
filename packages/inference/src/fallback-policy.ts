// Preview-only fallback eligibility. The production gateway does not import it.
// These fields are necessary but NOT sufficient authorization: production must
// read trusted provider approvals and signed subject x age-band evaluation rows.
export type TutorFallbackCause =
  | 'provider-unavailable'
  | 'provider-timeout'
  | 'rate-limited'
  | 'provider-refusal'
  | 'safety-block'
  | 'budget-complete'
  | 'learner-disabled';

export interface FallbackReadiness {
  readonly cause: TutorFallbackCause;
  readonly providerApproved: boolean;
  readonly gradeAndSubjectEvaluated: boolean;
  readonly zeroRetentionVerified: boolean;
  readonly safetyPlaneAvailable: boolean;
  readonly guardianPermissionConfirmed: boolean;
  readonly learnerBudgetAvailable: boolean;
}

export function qwenFallbackEligibleForReview(readiness: FallbackReadiness): boolean {
  if (readiness.cause !== 'provider-unavailable' &&
      readiness.cause !== 'provider-timeout' &&
      readiness.cause !== 'rate-limited') return false;
  return readiness.providerApproved &&
    readiness.gradeAndSubjectEvaluated &&
    readiness.zeroRetentionVerified &&
    readiness.safetyPlaneAvailable &&
    readiness.guardianPermissionConfirmed &&
    readiness.learnerBudgetAvailable;
}
