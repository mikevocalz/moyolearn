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
