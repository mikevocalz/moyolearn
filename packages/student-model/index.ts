// @acme/student-model — Loop A (doc 07 §4): the system learns the child, the
// model never does. Structured facts, a distillation job, a pseudonymous brief,
// and an erasure cascade that is defined on provenance so it is actually true.
// Server-side only, like @acme/safety — the retrieval path and the prompt
// assembly live behind this barrel and stay there. The one thing a guardian's
// device legitimately computes, the erasure-cascade preview, has its own
// entry point at `@acme/student-model/pure`; S27 imports that and nothing else.
// Nothing here writes to a model, and nothing here is a model.
// SOT: docs/pack/07-security-child-ai-safety-spec.md §4 · docs/pack/19-learning-outcomes-spec.md §1 §3
// SOT-KEYWORDS: student model barrel facts distill brief erasure mastery review inference

export {
  masteryFact,
  misconceptionFact,
  reviewFact,
  interestFact,
  scaffoldingFact,
  masterySentence,
  isMisconceptionTag,
  isExpired,
  addDays,
  MISCONCEPTIONS,
  FACT_TTL_DAYS,
  TRANSCRIPT_TTL_DAYS,
} from './src/facts';
export type {
  DerivedFact,
  FactKind,
  FactProvenance,
  MasteryFact,
  MisconceptionFact,
  MisconceptionTag,
  ReviewFact,
  InterestFact,
  ScaffoldingFact,
} from './src/facts';

export { traceAttempt, decayMastery, isFrontier, DEFAULT_TRACING, FRONTIER_LOW, FRONTIER_HIGH } from './src/mastery';
export type { TracingParams } from './src/mastery';

export { scheduleReview, isDue, REVIEW_LADDER } from './src/review';
export type { ReviewState } from './src/review';

export { distill, transcriptExpiry, factId, masteryFacts, reviewFacts } from './src/distill';
export type { DistillOptions, SessionTranscript, SessionTurn } from './src/distill';

export { compileLearnerBrief } from './src/brief';
export type { CompileOptions, LearnerBrief } from './src/brief';

export {
  eraseFact,
  eraseTranscript,
  cascadePreview,
  expireTranscripts,
  withoutBlockedTags,
} from './src/erasure';
export type { ErasureResult } from './src/erasure';

export { withLearnerBrief, briefPreamble } from './src/inference';
export type { BriefLookup, ModelCall } from './src/inference';
