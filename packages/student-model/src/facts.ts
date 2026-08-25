// The student model's atoms: derived pedagogical facts, and the sentence each
// one says out loud.
//
// Doc 19 §3 is the binding decision — "embed content, tag children". The model
// of a child is STRUCTURED (numbers on skill nodes, typed misconception tags,
// dates), never a vector, because four product requirements fall out of that
// choice and none of them survives an embedding: S27 must show what Natalie
// remembers in words, a guardian must be able to inspect it, an auditor must be
// able to read it, and erasure must cascade. A learner represented as a vector
// satisfies none of the four.
//
// `sentence` is therefore part of the fact, not a render-time formatting call.
// A fact that cannot state itself in parent language is a fact S27 cannot show,
// and doc 07 §S27 makes showing it the whole feature — so the constructor is
// the only way to build one, and it always produces the sentence.
//
// Every fact carries `derivedFrom` and `expiresAt`. Provenance is what makes the
// erasure cascade mechanical rather than a best-effort sweep (see erasure.ts),
// and an expiry on the DERIVED fact — not just on the transcript — is doc 07
// §4's "transcripts expire after distillation" read honestly: a fact distilled
// from a transcript is still learner data and cannot outlive its own welcome.
// SOT: docs/pack/19-learning-outcomes-spec.md §1 §3 · docs/pack/07-security-child-ai-safety-spec.md §4
// SOT-KEYWORDS: student model derived fact mastery misconception review interest provenance expiry sentence

/** Doc 19 §1's per-learner store, one variant per thing the system tracks. */
export type FactKind = 'mastery' | 'misconception' | 'review' | 'interest' | 'scaffolding';

export interface FactProvenance {
  /** Transcript ids this fact was distilled from. Erasure walks this list. */
  derivedFrom: readonly string[];
  observedAt: string;
  /** ISO date. Past it, the fact is not retrievable and not shown. */
  expiresAt: string;
}

interface FactCommon extends FactProvenance {
  id: string;
  learnerId: string;
  /** Parent language, doc 07 §S27. Built at construction, never at render. */
  sentence: string;
}

export interface MasteryFact extends FactCommon {
  kind: 'mastery';
  skillId: string;
  skillTitle: string;
  /** Probability the learner has the skill. Knowledge tracing, see mastery.ts. */
  p: number;
  /** Attempts behind `p`. A single attempt is an opinion, not a measurement. */
  attempts: number;
}

export interface MisconceptionFact extends FactCommon {
  kind: 'misconception';
  skillId: string;
  /** A tag from the curated taxonomy — never free text from a model. */
  tag: string;
  /** Doc 19 §1: addressed by name in tutoring strategy. */
  strategy: string;
  active: boolean;
}

export interface ReviewFact extends FactCommon {
  kind: 'review';
  skillId: string;
  skillTitle: string;
  dueAt: string;
  /** Days until the next review if this one goes well. */
  intervalDays: number;
}

export interface InterestFact extends FactCommon {
  kind: 'interest';
  /** Guardian opt-in (doc 07 §4 Loop A) — the flag lives with the fact so a
   *  retrieval path cannot use an interest the family never agreed to. */
  tag: string;
  guardianApproved: boolean;
}

export interface ScaffoldingFact extends FactCommon {
  kind: 'scaffolding';
  skillId: string;
  /** Mean hint depth before the learner gets there: the hint-ladder calibration. */
  hintDepth: number;
}

export type DerivedFact =
  | MasteryFact
  | MisconceptionFact
  | ReviewFact
  | InterestFact
  | ScaffoldingFact;

/**
 * The curated misconception taxonomy (doc 19 §1: "tagged, specific"). It is a
 * closed list on purpose — doc 19 §3 says the child's utterance is embedded
 * TRANSIENTLY to match against this taxonomy and the structured tag is what gets
 * stored. A model that could invent a tag would be writing free-text notes about
 * a child, which is the thing this design exists to prevent.
 */
export const MISCONCEPTIONS = {
  'adds-denominators': {
    skillId: 'fraction-addition',
    sentence: 'Adds the bottom numbers when adding fractions',
    strategy: 'Return to unit fractions before renaming; do not correct the answer, correct the model.',
  },
  'fraction-as-two-wholes': {
    skillId: 'fraction-sense',
    sentence: 'Reads a fraction as two separate whole numbers',
    strategy: 'Anchor on one shared whole — a single bar split two ways — before any arithmetic.',
  },
  'multiplication-always-grows': {
    skillId: 'fraction-multiplication',
    sentence: 'Expects multiplying to make a number bigger',
    strategy: 'Use a half-of-a-half picture first; let the contradiction land before naming the rule.',
  },
  'equals-means-answer': {
    skillId: 'equation-sense',
    sentence: 'Treats "=" as "here comes the answer" rather than as balance',
    strategy: 'Balance-scale framing with true/false number sentences, no solving yet.',
  },
  'ignores-place-value': {
    skillId: 'decimal-sense',
    sentence: 'Compares decimals by digit count instead of place value',
    strategy: 'Line up on a number line rather than in a column; the column is what taught the error.',
  },
} as const satisfies Record<string, { skillId: string; sentence: string; strategy: string }>;

export type MisconceptionTag = keyof typeof MISCONCEPTIONS;

export const isMisconceptionTag = (tag: string): tag is MisconceptionTag =>
  Object.hasOwn(MISCONCEPTIONS, tag);

/** Doc 07 §4: derived facts outlive transcripts, but not indefinitely. */
export const FACT_TTL_DAYS = 400;
/** Doc 07 §4 + ADR-006: the raw transcript's window, much shorter than the fact's. */
export const TRANSCRIPT_TTL_DAYS = 30;

export const addDays = (from: Date, days: number): string =>
  new Date(from.getTime() + days * 86_400_000).toISOString();

const round = (n: number, places: number) => Number(n.toFixed(places));

export const isExpired = (fact: FactProvenance, now: Date): boolean =>
  Date.parse(fact.expiresAt) <= now.getTime();

/**
 * Mastery in parent language. The number is never shown as a probability on
 * S27 — "0.68 mastery" is a dashboard metric, not something a parent asked for.
 * The bands are deliberately coarse for the same reason doc 19 §2 keeps
 * individual drill-down at mastery level: precision here implies a measurement
 * certainty three attempts do not support.
 */
export function masterySentence(skillTitle: string, p: number, attempts: number): string {
  if (attempts < 3) return `Just started on ${skillTitle}`;
  if (p >= 0.85) return `Has ${skillTitle} down`;
  if (p >= 0.6) return `Getting there on ${skillTitle}`;
  if (p >= 0.35) return `Still working on ${skillTitle}`;
  return `Finding ${skillTitle} hard right now`;
}

export function masteryFact(input: {
  id: string;
  learnerId: string;
  skillId: string;
  skillTitle: string;
  p: number;
  attempts: number;
  derivedFrom: readonly string[];
  observedAt: Date;
}): MasteryFact {
  const p = round(input.p, 3);
  return {
    kind: 'mastery',
    id: input.id,
    learnerId: input.learnerId,
    skillId: input.skillId,
    skillTitle: input.skillTitle,
    p,
    attempts: input.attempts,
    sentence: masterySentence(input.skillTitle, p, input.attempts),
    derivedFrom: input.derivedFrom,
    observedAt: input.observedAt.toISOString(),
    expiresAt: addDays(input.observedAt, FACT_TTL_DAYS),
  };
}

export function misconceptionFact(input: {
  id: string;
  learnerId: string;
  tag: MisconceptionTag;
  active: boolean;
  derivedFrom: readonly string[];
  observedAt: Date;
}): MisconceptionFact {
  const entry = MISCONCEPTIONS[input.tag];
  return {
    kind: 'misconception',
    id: input.id,
    learnerId: input.learnerId,
    skillId: entry.skillId,
    tag: input.tag,
    strategy: entry.strategy,
    active: input.active,
    sentence: entry.sentence,
    derivedFrom: input.derivedFrom,
    observedAt: input.observedAt.toISOString(),
    expiresAt: addDays(input.observedAt, FACT_TTL_DAYS),
  };
}

export function reviewFact(input: {
  id: string;
  learnerId: string;
  skillId: string;
  skillTitle: string;
  dueAt: string;
  intervalDays: number;
  derivedFrom: readonly string[];
  observedAt: Date;
}): ReviewFact {
  return {
    kind: 'review',
    id: input.id,
    learnerId: input.learnerId,
    skillId: input.skillId,
    skillTitle: input.skillTitle,
    dueAt: input.dueAt,
    intervalDays: input.intervalDays,
    sentence: `Due for a ${input.skillTitle} refresher`,
    derivedFrom: input.derivedFrom,
    observedAt: input.observedAt.toISOString(),
    expiresAt: addDays(input.observedAt, FACT_TTL_DAYS),
  };
}

export function interestFact(input: {
  id: string;
  learnerId: string;
  tag: string;
  guardianApproved: boolean;
  derivedFrom: readonly string[];
  observedAt: Date;
}): InterestFact {
  return {
    kind: 'interest',
    id: input.id,
    learnerId: input.learnerId,
    tag: input.tag,
    guardianApproved: input.guardianApproved,
    sentence: `Likes examples about ${input.tag}`,
    derivedFrom: input.derivedFrom,
    observedAt: input.observedAt.toISOString(),
    expiresAt: addDays(input.observedAt, FACT_TTL_DAYS),
  };
}

export function scaffoldingFact(input: {
  id: string;
  learnerId: string;
  skillId: string;
  skillTitle: string;
  hintDepth: number;
  derivedFrom: readonly string[];
  observedAt: Date;
}): ScaffoldingFact {
  const depth = round(input.hintDepth, 2);
  const sentence =
    depth >= 2
      ? `Wants a couple of hints before ${input.skillTitle} clicks`
      : `Gets going on ${input.skillTitle} with little help`;
  return {
    kind: 'scaffolding',
    id: input.id,
    learnerId: input.learnerId,
    skillId: input.skillId,
    hintDepth: depth,
    sentence,
    derivedFrom: input.derivedFrom,
    observedAt: input.observedAt.toISOString(),
    expiresAt: addDays(input.observedAt, FACT_TTL_DAYS),
  };
}
