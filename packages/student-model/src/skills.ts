// Lightweight skill inference from a problem string.
// This is a curriculum heuristic, not a model: it gives the tutor a readable
// skill name for mastery tracking while the Safety Plane's classifier owns
// the authoritative skill binding on the server side.
// SOT: docs/pack/19-learning-outcomes-spec.md §3
// SOT-KEYWORDS: student model skill inference heuristic curriculum problem hint

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
  if (lower.includes('algebra') || lower.includes('x') || lower.includes('y')) return 'Algebra basics';
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
