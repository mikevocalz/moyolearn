import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateArithmetic } from './evaluate.ts';

describe('evaluateArithmetic', () => {
  it('is true for a correct order-of-operations answer', () => {
    assert.equal(evaluateArithmetic('2+2*3', '8'), true);
  });

  it('is false for a wrong order-of-operations answer', () => {
    assert.equal(evaluateArithmetic('2+2*3', '11'), false);
  });

  it('strips words and evaluates the expression', () => {
    assert.equal(evaluateArithmetic('What is 5 + 3?', '8'), true);
  });

  it('handles parentheses', () => {
    assert.equal(evaluateArithmetic('(10 + 2) / 3', '4'), true);
  });

  it('handles division and addition', () => {
    assert.equal(evaluateArithmetic('10 / 2 + 3', '8'), true);
  });

  it('handles decimals', () => {
    assert.equal(evaluateArithmetic('3.5 * 2', '7'), true);
  });

  it('grades a leading negative instead of marking a correct answer wrong', () => {
    /*
      The regression this pins: `-3 + 5` popped an empty stack, produced `NaN`,
      and `Math.abs(NaN - 2) < 1e-9` answered `false`. A child who typed the
      right answer was marked incorrect and `traceAttempt` moved their mastery
      DOWN for it — the one failure mode this evaluator must never have.
    */
    assert.equal(evaluateArithmetic('-3 + 5', '2'), true);
    assert.equal(evaluateArithmetic('-3 + 5', '8'), false);
    assert.equal(evaluateArithmetic('What is -5 + 8?', '3'), true);
  });

  it('binds a negative literal tighter than the operator before it', () => {
    // `2 * -3` is 2 × (−3), never (2 × 0) − 3.
    assert.equal(evaluateArithmetic('2 * -3', '-6'), true);
    assert.equal(evaluateArithmetic('5 - -3', '8'), true);
    assert.equal(evaluateArithmetic('-(3+1)', '-4'), true);
  });

  it('answers null — never a verdict — for a shape it cannot represent', () => {
    // A negated parenthesis after an operator has no correct binary rewrite.
    assert.equal(evaluateArithmetic('2 * -(3+1)', '-8'), null);
  });

  it('returns null for non-arithmetic problems', () => {
    assert.equal(evaluateArithmetic('explain gravity', '5'), null);
  });

  it('returns null for non-numeric answers', () => {
    assert.equal(evaluateArithmetic('2+2', 'four'), null);
  });

  it('is true for decimal answers matching integer results', () => {
    assert.equal(evaluateArithmetic('2+2', '4.0'), true);
  });
});
