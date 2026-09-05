// Lightweight skill inference from a problem string.
// This is a curriculum heuristic, not a model: it gives the tutor a readable
// skill name for mastery tracking while the Safety Plane's classifier owns
// the authoritative skill binding on the server side.
// SOT: docs/pack/19-learning-outcomes-spec.md §3
// SOT-KEYWORDS: student model skill inference heuristic curriculum problem hint
import type { DerivedFact } from './facts.ts';

const DEFAULT_HINTS: [string, string] = [
  'Start by identifying the operation with the highest precedence.',
  'Then work through the problem one step at a time.',
];

const SKILL_HINTS: Record<string, [string, string]> = {
  Fractions: [
    'Look for one shared whole the pieces come from.',
    'Rename the fractions so the pieces match, then add or subtract.',
  ],
  Decimals: [
    'Line the numbers up by place value, not by digit count.',
    'Think about which one is closer to the next whole number.',
  ],
  Percent: [
    'Percent means "out of one hundred" — find the part and the whole.',
    'Ask whether the answer should be more or less than the whole.',
  ],
  'Equation sense': [
    'Both sides of the equals sign must stay balanced.',
    'Undo one operation at a time to find the unknown.',
  ],
  'Algebra basics': [
    'Combine only the like terms — same variable, same power.',
    'Watch the sign in front of each term as you move it.',
  ],
  'Order of operations': [
    'Do multiplication and division before addition and subtraction.',
    'Work inside parentheses first, then left to right.',
  ],
};

export function inferSkillTitle(problem: string): string {
  const lower = problem.toLowerCase();

  if (lower.includes('fraction') || /\d+\/\d+/.test(problem)) return 'Fractions';
  if (lower.includes('decimal') || /\d+\.\d+/.test(problem)) return 'Decimals';
  if (lower.includes('percent') || lower.includes('%')) return 'Percent';
  if (lower.includes('equation') || lower.includes('=') || lower.includes('solve for')) return 'Equation sense';
  /*
    A STANDALONE `x` or `y`, not the letter anywhere in a word. `includes('x')`
    and `includes('y')` matched `many`, `you`, `day`, `six`, `next`, `box` and
    `explain` — so "How many apples are left?" was filed as algebra, the
    `word problem` branch below it was near-unreachable, and a first grader
    doing subtraction was handed "Combine only the like terms". The lookarounds
    rather than `\b` because `2x` has no word boundary between the digit and
    the variable, and `2x` is the shape that matters.
  */
  if (lower.includes('algebra') || /(?<![a-z])[xy](?![a-z])/.test(lower)) return 'Algebra basics';
  if (lower.includes('word problem')) return 'Word problems';
  if (/[+/\-*/]/.test(problem)) return 'Order of operations';
  return 'Number sense';
}

function hintsForSkill(skillTitle: string): [string, string] {
  return SKILL_HINTS[skillTitle] ?? DEFAULT_HINTS;
}

/** First scaffold in the Socratic ladder for this skill. */
export function firstHint(skillTitle: string): string {
  return hintsForSkill(skillTitle)[0];
}

/** Second scaffold in the Socratic ladder for this skill. */
export function secondHint(skillTitle: string): string {
  return hintsForSkill(skillTitle)[1];
}

/** Generate a simple auto-tutor problem for a known skill. */
/**
 * Which branch of the adaptive picker chose a skill.
 *
 * `review` and `mastery` are read off the learner's own facts. `seed` is a
 * starting point for a learner who has none yet, and the distinction is the
 * whole reason this type exists: inside a session a practice problem is a
 * practice problem, but a surface that tells a child what they are working on
 * would be inventing a claim about their learning if it rendered a seeded
 * skill as theirs.
 */
export type NextProblemSource = 'review' | 'mastery' | 'seed';

/** The adaptive next problem, as every reader of it sees it. */
export interface NextProblem {
  skillTitle: string;
  problem: string;
  source: NextProblemSource;
}

/**
 * Choose the skill the learner meets next.
 *
 * Order: a review that is actually due, then the weakest mastery, then a seed.
 * The order is the pedagogy — a due review is spaced repetition asking for its
 * slot, and jumping it to practise something weaker loses the spacing.
 *
 * `now` is a parameter because "due" is a comparison against a clock, and a
 * picker that read the clock itself could not be tested at a boundary.
 *
 * The `seed` branch is the one callers must handle rather than render blindly:
 * it fires for a learner with no facts, so the skill it returns is an offer and
 * not an observation.
 */
export function pickNextSkill(
  facts: readonly DerivedFact[],
  now: string,
  seeds: readonly string[],
  pickSeed: (count: number) => number = (count) => Math.floor(Math.random() * count),
): { skillTitle: string; source: NextProblemSource } {
  let dueReview: string | undefined;
  let weakest: { skillTitle: string; p: number } | undefined;

  for (const fact of facts) {
    if (fact.kind === 'review') {
      // First due review wins, matching the caller's previous `reviews[0]`:
      // facts arrive in the repository's order and re-sorting here would
      // silently change which skill a learner meets.
      if (fact.dueAt <= now && dueReview === undefined) dueReview = fact.skillTitle;
    } else if (fact.kind === 'mastery') {
      if (weakest === undefined || fact.p < weakest.p) {
        weakest = { skillTitle: fact.skillTitle, p: fact.p };
      }
    }
  }

  if (dueReview !== undefined) return { skillTitle: dueReview, source: 'review' };
  if (weakest !== undefined) return { skillTitle: weakest.skillTitle, source: 'mastery' };
  return { skillTitle: seeds[pickSeed(seeds.length)] ?? seeds[0]!, source: 'seed' };
}

export function generatePracticeProblem(skillTitle: string): string | null {
  switch (skillTitle) {
    case 'Fractions':
      return 'What is 1/2 + 1/4?';
    case 'Decimals':
      return 'What is 3.14 + 2.71?';
    case 'Percent':
      return 'What is 25% of 80?';
    case 'Equation sense':
      return 'Solve for x: 2x + 3 = 7';
    case 'Algebra basics':
      return 'Simplify 2x + 3 + 4x - 1';
    case 'Order of operations':
      return 'What is 2 + 3 * 4 - 1?';
    default:
      return null;
  }
}
