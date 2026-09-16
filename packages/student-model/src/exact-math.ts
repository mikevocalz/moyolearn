// Executable exact-rational tool; no source authorization is inferred here.
// The server must resolve readiness and current evidence revision before assessment.
// SOT: docs/decisions/adr-homework-exact-math.md
// SOT-KEYWORDS: subject tool fractions arithmetic exact Cortex MathJSON revision
import { ComputeEngine, isNumber } from '@cortex-js/compute-engine';
import type { MathJsonExpression } from '@cortex-js/compute-engine/math-json';
import { EXACT_MATH_LIMITS, parseMathExpression, validateMathExpression } from './math-expression.ts';

export function checkMathJson(problem: MathJsonExpression, answer: MathJsonExpression) {
  if (!validateMathExpression(problem) || !validateMathExpression(answer)) {
    return { status: 'uncheckable', reason: 'unsupported-expression' } as const;
  }
  try {
    // An isolated engine prevents definitions or assumptions crossing requests.
    const engine = new ComputeEngine();
    return engine.withTimeLimit(EXACT_MATH_LIMITS.evaluationMs, () => {
      function finiteValue(source: MathJsonExpression): ReturnType<ComputeEngine['expr']> | null {
        let input = source;
        if (Array.isArray(source)) {
          const [operator, ...operands] = source;
          const evaluated: MathJsonExpression[] = [];
          for (const operand of operands) {
            const value = finiteValue(operand);
            if (value === null) return null;
            evaluated.push(value.json);
          }
          input = [operator!, ...evaluated];
        }
        // Inspect every operand before parent canonicalization. Otherwise
        // 1/(1/0) can simplify to zero and conceal an undefined inner division.
        const result = engine.expr(input).evaluate();
        return isNumber(result) && result.isValid && result.isFinite === true
          && result.isRational === true && result.isExact ? result : null;
      }
      const expected = finiteValue(problem);
      const received = finiteValue(answer);
      if (expected === null || received === null) {
        return { status: 'uncheckable', reason: 'non-finite-or-inexact' } as const;
      }
      // Canonical exact rationals have a unique reduced representation. Using
      // structural identity avoids the numeric tolerances of equality helpers.
      return expected.isSame(received)
        ? { status: 'equivalent' } as const
        : { status: 'not-equivalent' } as const;
    });
  } catch {
    return { status: 'tool-error', reason: 'evaluation-failed' } as const;
  }
}

export function checkExactMath(problem: string, answer: string) {
  const problemMath = parseMathExpression(problem, true);
  const answerMath = parseMathExpression(answer);
  if (problemMath === null || answerMath === null) {
    return { status: 'uncheckable', reason: 'unsupported-expression' } as const;
  }
  return checkMathJson(problemMath, answerMath);
}

export const exactMathTool = {
  id: 'fractions',
  version: '1',
  engine: '@cortex-js/compute-engine',
  engineVersion: '0.128.12',
  domain: 'finite-exact-rationals',
  limits: EXACT_MATH_LIMITS,
  execute(problem: MathJsonExpression, answer: MathJsonExpression, evidenceRevision: string) {
    const metadata = {
      evidenceRevision,
      tool: 'fractions',
      toolVersion: '1',
      engineVersion: '0.128.12',
      domain: 'finite-exact-rationals',
    } as const;
    if (!evidenceRevision.trim()) {
      return { ...metadata, status: 'evidence-unresolved', reason: 'missing-revision' } as const;
    }
    return { ...metadata, ...checkMathJson(problem, answer) };
  },
} as const;

export type ExactMathResult = ReturnType<typeof exactMathTool.execute>;
