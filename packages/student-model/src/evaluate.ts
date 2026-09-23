// Compatibility boundary for deterministic arithmetic callers.
// Exact expressions use the same bounded MathJSON tool as subject checking.
// SOT: docs/decisions/adr-homework-exact-math.md
// SOT-KEYWORDS: student model evaluate arithmetic fractions exact MathJSON
import { checkExactMath } from './exact-math.ts';

/** A verdict requires two supported, finite exact expressions. */
export function evaluateArithmetic(problem: string, answer: string): boolean | null {
  const result = checkExactMath(problem, answer);
  if (result.status === 'equivalent') return true;
  if (result.status === 'not-equivalent') return false;
  return null;
}
