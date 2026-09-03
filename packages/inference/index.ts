// @acme/inference — the Inference Gateway (doc 12 §3, §9.3): the sole egress to
// a model provider, and the only package in the repo that holds provider
// credentials. Server-side only, like @acme/safety and @acme/student-model.
//
// A feature never imports the adapter. It imports the gateway, hands it a
// payload of two strings, and gets back either a stream or an ended session —
// there is no argument order that reaches a vendor with the routing table, the
// pseudonymization scrub, or the budget skipped.
//
// It must not be able to read a child's record: `tooling/check-no-training-path.mjs`
// fails the build if this package grows an import of `@acme/payload` or a
// repository. "We can't" beats "we won't".
// SOT: docs/design/inference-gateway.md · docs/pack/12-systems-design-prompt.md §9.3
// SOT-KEYWORDS: inference barrel gateway adapter routing budget pseudonymization egress anthropic claude

export { createInferenceGateway, inferenceGateway } from './src/gateway.ts';
export type { GatewayOptions, InferenceGateway, TutorTurn, TutorTurnInput } from './src/gateway.ts';

export {
  anthropicAdapter,
  anthropicTransport,
  createAnthropicAdapter,
  completionParamsFor,
  paramsFor,
} from './src/anthropic.ts';
export type {
  AnthropicAdapter,
  AnthropicTransport,
  VendorMessage,
  VendorStream,
  VendorStreamEvent,
} from './src/anthropic.ts';

export { isKnownModel, modelFor, requestFor, routeFor, ROUTING } from './src/routing.ts';
export type { RoutingCell } from './src/routing.ts';

export { MODEL_PROFILES, priceUsd, profileFor } from './src/models.ts';
export type { EffortModel, FlatModel, ModelId, ModelProfile } from './src/models.ts';

export {
  budgetStateFor,
  budgetLedgerInstalled,
  dayKey,
  endedOnCeiling,
  inMemoryLedger,
  installBudgetLedger,
  sharedBudgetLedger,
  BREAK_NUDGE,
  DEFAULT_LEARNER_BUDGET,
  GREAT_WORK_TODAY,
} from './src/budget.ts';
export type { BudgetLedger, LearnerBudget, LedgerDay, SessionBudgetState } from './src/budget.ts';

export { REDACTED, scrubOutbound, scrubText } from './src/pseudonymize.ts';

export { ModelDeclined, ProviderUnavailable } from './src/errors.ts';

export type {
  ClassifierRole,
  DeclineCategory,
  Effort,
  InferenceCompletion,
  InferenceOutcome,
  InferencePayload,
  InferenceRequest,
  InferenceRole,
  InferenceStop,
  InferenceStream,
  InferenceUsage,
  ProviderAdapter,
  TurnImage,
} from './src/types.ts';
