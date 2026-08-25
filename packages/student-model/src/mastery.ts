// Knowledge tracing: how one attempt moves a mastery estimate, and how time
// moves it back.
//
// Doc 19 §3 pins the method — "knowledge tracing is Bayesian updates over
// attempt rows" — so this is Bayesian Knowledge Tracing in its standard form
// (Corbett & Anderson): a posterior conditioned on the observed answer, then a
// learning step for the chance the attempt itself taught something.
//
// The parameters are per-skill and NOT learned from learner data. Fitting slip
// and guess per child would be building a model of the child in weights, which
// doc 07 §4 rules out at the architecture level; these are curriculum
// constants an expert sets, which is also doc 19 §1's "prompt/curriculum tuning
// authored by experts". The defaults below are the conventional starting
// values, and a skill overrides them in the content store, not here.
//
// Decay exists because doc 19 §1 asks for it in one clause — "with decay so
// stale mastery gets rechecked" — and because a child who nailed fractions in
// October is not the same evidence in March. It pulls toward the prior rather
// than toward zero: forgetting returns you to uncertainty, not to incompetence.
// SOT: docs/pack/19-learning-outcomes-spec.md §1 §3
// SOT-KEYWORDS: mastery knowledge tracing bkt bayesian update decay slip guess attempt

export interface TracingParams {
  /** P(knows it, answers wrong anyway). */
  slip: number;
  /** P(doesn't know it, answers right anyway). */
  guess: number;
  /** P(learns it on this attempt). */
  learn: number;
  /** The population prior; also where decay pulls back to. */
  prior: number;
}

export const DEFAULT_TRACING: TracingParams = {
  slip: 0.1,
  guess: 0.2,
  learn: 0.15,
  prior: 0.25,
};

/** Half-life of an un-rehearsed mastery estimate, in days. */
const DECAY_HALF_LIFE_DAYS = 45;

/**
 * One attempt. Returns the updated probability, clamped away from 0 and 1 —
 * a certainty of 1 is unrecoverable by any later evidence, and a tutor that
 * cannot be surprised by a child is the failure mode this whole store exists
 * to avoid.
 */
export function traceAttempt(
  p: number,
  correct: boolean,
  params: TracingParams = DEFAULT_TRACING,
): number {
  const { slip, guess, learn } = params;
  const posterior = correct
    ? (p * (1 - slip)) / (p * (1 - slip) + (1 - p) * guess)
    : (p * slip) / (p * slip + (1 - p) * (1 - guess));
  const next = posterior + (1 - posterior) * learn;
  return Math.min(0.99, Math.max(0.01, next));
}

/**
 * Exponential decay toward the prior. Called when a mastery fact is read, not
 * on a schedule: a nightly job that rewrites every learner's every skill is a
 * lot of writes to express "time passed", which the read already knows.
 */
export function decayMastery(
  p: number,
  observedAt: Date,
  now: Date,
  params: TracingParams = DEFAULT_TRACING,
): number {
  const days = (now.getTime() - observedAt.getTime()) / 86_400_000;
  if (days <= 0) return p;
  const retained = 2 ** (-days / DECAY_HALF_LIFE_DAYS);
  return params.prior + (p - params.prior) * retained;
}

/**
 * Doc 19 §1's "frontier skills" for the learner brief: not what she has mastered
 * and not what is hopeless — the band where the next session actually moves the
 * needle. The window is the pedagogical claim; the sort is so a brief that gets
 * truncated keeps the closest-to-breaking-through skill.
 */
export const FRONTIER_LOW = 0.35;
export const FRONTIER_HIGH = 0.85;

export const isFrontier = (p: number): boolean => p >= FRONTIER_LOW && p < FRONTIER_HIGH;
