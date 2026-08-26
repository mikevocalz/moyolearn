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
