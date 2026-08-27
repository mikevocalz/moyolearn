// @acme/auth — Better Auth integration (doc 06). Server and client are separate
// entrypoints so app code never pulls the pg Pool into a bundle.
// SOT: docs/pack/06-auth-onboarding-spec.md
// SOT-KEYWORDS: auth barrel better-auth server client

export { createMoyoAuthClient } from './src/client';
export type { MoyoAuthClient } from './src/client';
export {
  validateConsent,
  validateCreateLearner,
  validateLearnerPassword,
  validateLearnerUsername,
} from './src/create-learner';
export type { ConsentMethod, CreateLearnerInput } from './src/create-learner';
export { isPlaceholderEmail, learnerPlaceholderEmail } from './src/create-learner';
export { createManagedLearner, CreateLearnerError } from './src/create-managed-learner';
export type { LearnerWriter } from './src/create-managed-learner';
export { createPayloadLearnerWriter } from './src/payload-learner-writer';
export {
  HANDOFF_CODE_LENGTH,
  HANDOFF_TTL_MS,
  handoffUrl,
  isWellFormedHandoffCode,
  normalizeHandoffCode,
} from './src/handoff-code';
export {
  createDeviceHandoff,
  redeemDeviceHandoff,
  generateHandoffCode,
  hashHandoffCode,
  handoffSecret,
  HandoffError,
} from './src/handoff';
export type { HandoffStore, GuardianshipReader, HandoffIssue } from './src/handoff';
export {
  availableMethods,
  completeConsent,
  confirm,
  isChallengeComplete,
  isFallbackMethod,
  needsReconsent,
  scoreKba,
  startChallenge,
  verifyCode,
  isCodeExpired,
  CODE_TTL_MINUTES,
  CONSENT_DISCLOSURES,
  CONSENT_POLICY_VERSION,
  CONSENT_PROMISES,
  DEFAULT_CONSENT_ENVIRONMENT,
  KBA_PASS_MARK,
  KBA_QUESTION_COUNT,
  MAX_CODE_ATTEMPTS,
} from './src/consent-flow';
export type {
  CodeVerdict,
  ConsentChallenge,
  ConsentDisclosure,
  ConsentEnvironment,
  ConsentRecord,
  KbaQuestion,
} from './src/consent-flow';

export {
  authorizeReference,
  isBillingRole,
  isPlanName,
  plansFor,
  resolvePrices,
  BILLING_ROLES,
  PLANS,
} from './src/billing-plans';
export type {
  BillingRole,
  CustomerType,
  Plan,
  PlanLimits,
  PlanName,
  ReferenceRequest,
} from './src/billing-plans';
export {
  can,
  daysLeft,
  entitlementsFor,
  subscriptionFor,
  NO_SUBSCRIPTION,
} from './src/entitlements';
export type {
  Capability,
  Entitlements,
  SubscriptionState,
  SubscriptionStatus,
} from './src/entitlements';

export {
  cancellationOutcome,
  cancellationSummary,
  trialSchedule,
  CANCEL_STEPS,
  MAX_CANCEL_STEPS,
  TRIAL_REMINDER_DAYS_BEFORE,
} from './src/trial';
export type { CancelStep, CancellationOutcome, TrialSchedule } from './src/trial';
