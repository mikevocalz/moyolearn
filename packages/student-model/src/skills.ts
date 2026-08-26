// Lightweight skill inference from a problem string.
// This is a curriculum heuristic, not a model: it gives the tutor a readable
// skill name for mastery tracking while the Safety Plane's classifier owns
// the authoritative skill binding on the server side.
// SOT: docs/pack/19-learning-outcomes-spec.md §3
// SOT-KEYWORDS: student model skill inference heuristic curriculum problem

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
