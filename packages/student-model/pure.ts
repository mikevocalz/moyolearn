// The client-safe half of the student model.
//
// S27 has to show a guardian what a delete will take with it BEFORE they commit
// to it (doc 07 §4: erasure cascades — a promise nobody can act on if the
// cascade is invisible until afterwards). That preview is a pure predicate over
// provenance, so the alternative to this file is the screen re-deriving the same
// rule locally, which is precisely the "second way to do something that already
// has a way" CLAUDE.md bans — and the copy would be the one that drifts.
//
// So the cascade predicates get a subpath, and the main barrel keeps everything
// the client has no business holding: the retrieval path, the prompt assembly,
// the tracing parameters, the distillation gate. Splitting on "what may a
// guardian's device compute" rather than on "what is convenient" is why this is
// a second entry point and not simply a wider index.
// SOT: docs/pack/07-security-child-ai-safety-spec.md §4 §S27
// Re-exports carry the `.ts` extension, matching every file under `src/`. This
// entry point is imported by tests that run on bare `node --test`, and Node's
// ESM resolver does not guess extensions the way a bundler does.
// SOT-KEYWORDS: student model pure client cascade preview erasure subpath guardian s27

export { eraseFact, eraseTranscript, cascadePreview } from './src/erasure.ts';
export type { ErasureResult } from './src/erasure.ts';
export { isExpired } from './src/facts.ts';
export { masteryFact, misconceptionFact, masterySentence, isMisconceptionTag, MISCONCEPTIONS } from './src/facts.ts';
export type {
  DerivedFact,
  FactKind,
  FactProvenance,
  MasteryFact,
  MisconceptionFact,
  ReviewFact,
  InterestFact,
  ScaffoldingFact,
  MisconceptionTag,
} from './src/facts.ts';
export { traceAttempt, decayMastery, isFrontier, DEFAULT_TRACING, FRONTIER_LOW, FRONTIER_HIGH } from './src/mastery.ts';
export type { TracingParams } from './src/mastery.ts';
export { evaluateArithmetic } from './src/evaluate.ts';
export { inferSkillTitle, firstHint, secondHint, generatePracticeProblem } from './src/skills.ts';
