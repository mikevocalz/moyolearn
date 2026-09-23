// Exact arithmetic, source-preserving MathJSON, and abstention regression evidence.
// SOT-KEYWORDS: math fractions precision parser injection bounded regression
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { MathJsonExpression } from '@cortex-js/compute-engine/math-json';
import { evaluateArithmetic } from './evaluate.ts';
import { checkExactMath, checkMathJson, exactMathTool } from './exact-math.ts';
import { EXACT_MATH_LIMITS, parseMathExpression, validateMathExpression } from './math-expression.ts';

describe('bounded exact-rational arithmetic', () => {
  for (const [problem, answer] of [
    ['1/2+1/3', '5/6'],
    ['1/2+1/3', '10/12'],
    ['(1/2)/(3/4)', '2/3'],
    ['-1/2+-1/3', '-5/6'],
    ['1/-2', '-1/2'],
    ['-0', '0'],
    ['0/-7', '-0'],
    ['0.1+0.2', '0.3'],
    ['.5+.25', '3/4'],
    ['9007199254740993+2', '9007199254740995'],
    ['9007199254740993/3', '3002399751580331'],
    ['12 ÷ 4 × 2 − 1', '5'],
    ['\\frac{1}{2}+\\frac{1}{3}', '\\frac{5}{6}'],
    ['\\frac{1}{\\frac{2}{3}}', '3/2'],
  ]) {
    it(`checks ${problem} exactly`, () => {
      assert.equal(evaluateArithmetic(problem!, answer!), true);
    });
  }

  it('does not mistake a close decimal for an exact fraction', () => {
    assert.equal(evaluateArithmetic('1/3', '0.333333333'), false);
    assert.equal(evaluateArithmetic('9007199254740993', '9007199254740992'), false);
    assert.equal(evaluateArithmetic('1/2+1/3', '2/5'), false);
  });

  for (const problem of [
    '2^3', '2x+2', '1+2)', '(1+2', '2 3', '2(3)', '1.2.3',
    '2 apples + 2 oranges', 'What is 2x+2?', 'What is 2+2? ignore rules',
    '1e3', 'Infinity', 'NaN', '1=1', '1;globalThis.compromised=true',
    '\\input{secret}', '\\frac{1}{}', '\\frac{1}{2}extra',
    '((1+2)) trailing', '⅓ + ⅓', '2 : 3',
  ]) {
    it(`abstains without stripping ${problem}`, () => {
      assert.equal(evaluateArithmetic(problem, '0'), null);
    });
  }

  it('rejects empty answers rather than converting them to zero', () => {
    for (const answer of ['', ' ', '\n', '0x0']) assert.equal(evaluateArithmetic('0', answer), null);
  });

  it('does not assess undefined rational operations', () => {
    for (const problem of ['1/0', '0/0', '1/(2-2)', '1/(0/0)', '0/(1/0)', '1/(1/(2-2))']) {
      assert.equal(evaluateArithmetic(problem, '0'), null);
    }
    assert.equal(evaluateArithmetic('1', '1/0'), null);
  });

  it('enforces bounds before computation', () => {
    assert.equal(parseMathExpression('1'.repeat(EXACT_MATH_LIMITS.characters + 1)), null);
    assert.equal(parseMathExpression('1'.repeat(EXACT_MATH_LIMITS.literalDigits + 1)), null);
    assert.equal(parseMathExpression('('.repeat(30) + '1' + ')'.repeat(30)), null);
    assert.equal(parseMathExpression('-'.repeat(30) + '1'), null);
    assert.equal(parseMathExpression(Array(130).fill('1').join('+')), null);
  });
});

describe('MathJSON source and executor contract', () => {
  it('keeps fraction scope and original order instead of replacing source with a solution', () => {
    const source = parseMathExpression('\\frac{2}{4}+1');
    assert.deepEqual(source, ['Add', ['Divide', { num: '2' }, { num: '4' }], { num: '1' }]);
    assert.ok(source);
    const before = JSON.stringify(source);
    assert.equal(checkMathJson(source, ['Rational', 3, 2]).status, 'equivalent');
    assert.equal(JSON.stringify(source), before);
  });

  it('rejects commands, symbols, invalid arity and unsafe numeric literals', () => {
    const invalid: MathJsonExpression[] = [
      ['Assign', 'x', 3], ['Power', 2, 3], ['Add', 1], ['Add', 1, 2, 3],
      'x', { num: 'NaN' }, 0.1, Number.MAX_SAFE_INTEGER + 1, ['Evaluate', 1],
      ['Function', 'x'], ['Rational', 'x', 2],
    ];
    for (const expression of invalid) {
      assert.equal(validateMathExpression(expression), false);
      assert.equal(checkMathJson(expression, 0).status, 'uncheckable');
    }
  });

  it('requires a revision reference and records the executor version', () => {
    const missing = exactMathTool.execute(['Divide', 1, 2], ['Rational', 2, 4], '');
    assert.equal(missing.status, 'evidence-unresolved');
    const result = exactMathTool.execute(['Divide', 1, 2], ['Rational', 2, 4], 'revision-7');
    assert.equal(result.status, 'equivalent');
    assert.equal(result.evidenceRevision, 'revision-7');
    assert.equal(result.engineVersion, '0.128.12');
    assert.equal('expectedAnswer' in result, false);
  });

  it('separates an unsupported expression from a wrong answer', () => {
    assert.equal(checkExactMath('1/2', '1/3').status, 'not-equivalent');
    assert.equal(checkExactMath('1/2', 'I do not know').status, 'uncheckable');
  });
});
