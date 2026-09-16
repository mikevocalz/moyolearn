// A full-consumption arithmetic grammar and the matching MathJSON allowlist.
// Source trees retain fraction scope and operation order; tools canonicalize copies.
// SOT: docs/decisions/adr-homework-exact-math.md
// SOT-KEYWORDS: MathJSON fractions parser exact bounded source expression validation
import type { MathJsonExpression } from '@cortex-js/compute-engine/math-json';

export const EXACT_MATH_LIMITS = {
  characters: 2048,
  nodes: 128,
  depth: 24,
  literalDigits: 64,
  evaluationMs: 100,
} as const;

const operations = {
  Add: 2,
  Subtract: 2,
  Multiply: 2,
  Divide: 2,
  Rational: 2,
  Negate: 1,
} as const;

/** Restricts vendor MathJSON to a finite arithmetic tree, before boxing it. */
export function validateMathExpression(expression: MathJsonExpression): boolean {
  let nodes = 0;
  function visit(value: MathJsonExpression, depth: number): boolean {
    nodes += 1;
    if (nodes > EXACT_MATH_LIMITS.nodes || depth > EXACT_MATH_LIMITS.depth) return false;
    if (typeof value === 'number') return Number.isSafeInteger(value);
    if (Array.isArray(value)) {
      const [operator, ...operands] = value;
      if (typeof operator !== 'string' || !Object.hasOwn(operations, operator)) return false;
      const arity = operations[operator as keyof typeof operations];
      return operands.length === arity && operands.every((operand) => visit(operand, depth + 1));
    }
    if (value === null || typeof value !== 'object' || !('num' in value)) return false;
    // Metadata and other expression forms cannot smuggle an executable operand.
    return Object.keys(value).length === 1 && typeof value.num === 'string'
      && /^-?\d+$/.test(value.num)
      && value.num.replace('-', '').length <= EXACT_MATH_LIMITS.literalDigits;
  }
  return visit(expression, 0);
}

/** No unknown words, inferred operators, or ignored trailing characters. */
export function parseMathExpression(source: string, allowQuestionWrapper = false) {
  if (!source.trim() || source.length > EXACT_MATH_LIMITS.characters) return null;
  let input = source.trim();
  if (allowQuestionWrapper) {
    const wrapper = /^(?:What is|Calculate|Evaluate)\s+(.+?)\??$/i.exec(input);
    if (wrapper) input = wrapper[1]!.trim();
  }
  input = input.replaceAll('×', '*').replaceAll('÷', '/').replaceAll('−', '-');
  let position = 0;
  let nodes = 0;
  const skipSpace = () => { while (position < input.length && /\s/.test(input[position]!)) position += 1; };
  const node = (expression: MathJsonExpression): MathJsonExpression => {
    nodes += 1;
    if (nodes > EXACT_MATH_LIMITS.nodes) throw new Error('Expression limit');
    return expression;
  };
  const expect = (character: string) => {
    skipSpace();
    if (input[position] !== character) throw new Error('Missing delimiter');
    position += 1;
  };
  function primary(depth: number): MathJsonExpression {
    if (depth > EXACT_MATH_LIMITS.depth) throw new Error('Expression depth');
    skipSpace();
    const next = input[position];
    if (next === '+' || next === '-') {
      position += 1;
      const value = primary(depth + 1);
      return next === '-' ? node(['Negate', value]) : value;
    }
    if (next === '(') {
      position += 1;
      const value = sum(depth + 1);
      expect(')');
      return value;
    }
    if (input.startsWith('\\frac', position)) {
      position += 5;
      expect('{');
      const numerator = sum(depth + 1);
      expect('}');
      expect('{');
      const denominator = sum(depth + 1);
      expect('}');
      return node(['Divide', numerator, denominator]);
    }
    const literal = /^(?:\d+(?:\.\d+)?|\.\d+)/.exec(input.slice(position))?.[0];
    if (!literal || literal.replace('.', '').length > EXACT_MATH_LIMITS.literalDigits) throw new Error('Unsupported literal');
    position += literal.length;
    const [whole, fraction] = literal.split('.');
    if (fraction !== undefined) {
      return node(['Rational', node({ num: BigInt(`${whole || '0'}${fraction}`).toString() }), node({ num: (BigInt(10) ** BigInt(fraction.length)).toString() })]);
    }
    return node({ num: BigInt(literal).toString() });
  }
  function product(depth: number): MathJsonExpression {
    let value = primary(depth);
    skipSpace();
    while (input[position] === '*' || input[position] === '/') {
      const operator = input[position++]!;
      value = node([operator === '*' ? 'Multiply' : 'Divide', value, primary(depth)]);
      skipSpace();
    }
    return value;
  }
  function sum(depth: number): MathJsonExpression {
    let value = product(depth);
    skipSpace();
    while (input[position] === '+' || input[position] === '-') {
      const operator = input[position++]!;
      value = node([operator === '+' ? 'Add' : 'Subtract', value, product(depth)]);
      skipSpace();
    }
    return value;
  }
  try {
    const expression = sum(0);
    skipSpace();
    return position === input.length && validateMathExpression(expression) ? expression : null;
  } catch {
    return null;
  }
}
