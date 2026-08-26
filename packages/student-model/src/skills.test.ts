import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { inferSkillTitle } from './skills.ts';

describe('inferSkillTitle', () => {
  it('detects fraction problems', () => {
    assert.equal(inferSkillTitle('What is 1/2 + 1/4?'), 'Fractions');
  });

  it('detects decimal problems', () => {
    assert.equal(inferSkillTitle('Round 3.14159 to the nearest hundredth'), 'Decimals');
  });

  it('detects equation sense', () => {
    assert.equal(inferSkillTitle('Solve for x: 2x + 3 = 7'), 'Equation sense');
  });

  it('detects algebra basics', () => {
    assert.equal(inferSkillTitle('Simplify 2x + 3y - x'), 'Algebra basics');
  });

  it('detects order of operations', () => {
    assert.equal(inferSkillTitle('2 + 3 * 4'), 'Order of operations');
  });

  it('falls back to number sense', () => {
    assert.equal(inferSkillTitle('Count the apples'), 'Number sense');
  });
});
