// The learner brief: the compiled, pseudonymous packet every tutoring turn
// receives (doc 19 §1's loop, closing clause).
//
// "Pseudonymous" is load-bearing and is enforced by construction, not by
// review: the brief type has no field for a name, an id, a school, a birthday
// or a guardian, so there is nowhere for one to be added by accident. Doc 07 §4
// says payloads stay pseudonymous per ADR-005, and the way that survives six
// months of edits is a shape that cannot carry the thing it must not carry.
//
// The brief is also SMALL on purpose. Doc 19 §1 names five things — frontier
// skills, active misconceptions, review-due items, interests, band voice — and
// the temptation with a context window is to send the whole model. Sending the
// whole model is how a tutor turn starts referencing a misconception from March
// that the child resolved in April; the caps below are the pedagogy, not a token
// budget.
// SOT: docs/pack/19-learning-outcomes-spec.md §1 · docs/pack/07-security-child-ai-safety-spec.md §4
// SOT-KEYWORDS: learner brief compile pseudonymous frontier misconception review interest retrieval

import {
  isExpired,
  type DerivedFact,
  type InterestFact,
  type MisconceptionFact,
  type ReviewFact,
} from './facts.ts';
import { decayMastery, isFrontier, type TracingParams } from './mastery.ts';
import { isDue } from './review.ts';

export interface LearnerBrief {
  /** Drives voice and reading level. Doc 07 §3 layer 1: server-injected. */
  gradeBand: 'young' | 'older';
  /** Skills where the next session moves the needle, closest first. */
  frontier: readonly { skillTitle: string; sentence: string }[];
  /** Only the unresolved ones. A retired misconception is history, not context. */
  misconceptions: readonly { sentence: string; strategy: string }[];
  reviewDue: readonly string[];
  /** Guardian-approved only. */
  interests: readonly string[];
  /** Mean hint depth across frontier skills; the tutor's opening scaffold level. */
  scaffoldDepth: number;
}

const MAX_FRONTIER = 3;
const MAX_MISCONCEPTIONS = 3;
const MAX_REVIEW = 3;
const MAX_INTERESTS = 3;

export interface CompileOptions {
  tracing?: TracingParams;
}

/**
 * Facts in, brief out. Expired facts are filtered here as well as at the
 * repository — the compiler is the last thing between the store and a model, so
 * it is the right place to be paranoid about a stale row.
 */
export function compileLearnerBrief(
  facts: readonly DerivedFact[],
  gradeBand: LearnerBrief['gradeBand'],
  now: Date,
  options: CompileOptions = {},
): LearnerBrief {
  const live = facts.filter((fact) => !isExpired(fact, now));

  const frontier = live
    .filter((fact) => fact.kind === 'mastery')
    .map((fact) => ({
      ...fact,
      decayed: decayMastery(fact.p, new Date(fact.observedAt), now, options.tracing),
    }))
    .filter((fact) => isFrontier(fact.decayed))
    // Closest to breaking through first: if the brief is truncated, the skill
    // one good session from mastery is the one that survives.
    .sort((a, b) => b.decayed - a.decayed)
    .slice(0, MAX_FRONTIER);

  const scaffolds = live.filter((fact) => fact.kind === 'scaffolding');
  const frontierSkills = new Set(frontier.map((fact) => fact.skillId));
  const relevantScaffolds = scaffolds.filter((fact) => frontierSkills.has(fact.skillId));
  const scaffoldSource = relevantScaffolds.length > 0 ? relevantScaffolds : scaffolds;
  const scaffoldDepth =
    scaffoldSource.length === 0
      ? 1
      : scaffoldSource.reduce((sum, fact) => sum + fact.hintDepth, 0) / scaffoldSource.length;

  return {
    gradeBand,
    frontier: frontier.map((fact) => ({ skillTitle: fact.skillTitle, sentence: fact.sentence })),
    misconceptions: live
      .filter((fact): fact is MisconceptionFact => fact.kind === 'misconception' && fact.active)
      .slice(0, MAX_MISCONCEPTIONS)
      .map((fact) => ({ sentence: fact.sentence, strategy: fact.strategy })),
    reviewDue: live
      .filter(
        (fact): fact is ReviewFact =>
          fact.kind === 'review' &&
          isDue({ intervalDays: fact.intervalDays, dueAt: fact.dueAt }, now),
      )
      .slice(0, MAX_REVIEW)
      .map((fact) => fact.skillTitle),
    interests: live
      .filter((fact): fact is InterestFact => fact.kind === 'interest' && fact.guardianApproved)
      .slice(0, MAX_INTERESTS)
      .map((fact) => fact.tag),
    scaffoldDepth: Number(scaffoldDepth.toFixed(2)),
  };
}
