import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { inferSkillTitle, firstHint, secondHint } from './skills.ts';

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

describe('firstHint', () => {
  it('returns a skill-specific hint', () => {
    assert.ok(firstHint('Fractions').includes('shared whole'));
  });

  it('returns the default hint for unknown skills', () => {
    assert.ok(firstHint('Unknown').includes('precedence'));
  });
});

describe('secondHint', () => {
  it('returns a skill-specific follow-up', () => {
    assert.ok(secondHint('Order of operations').includes('parentheses'));
  });

  it('returns the default follow-up for unknown skills', () => {
    assert.ok(secondHint('Unknown').includes('one step at a time'));
  });
});
