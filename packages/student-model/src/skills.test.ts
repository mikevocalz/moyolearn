import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { inferSkillTitle, firstHint, secondHint, generatePracticeProblem } from './skills.ts';

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

  it('reads x and y as variables, not as letters inside ordinary words', () => {
    /*
      `includes('x') || includes('y')` matched `many`, `six`, `you`, `next` and
      `explain`, so most word problems were filed as algebra — and a first
      grader doing subtraction got `firstHint('Algebra basics')`: "Combine only
      the like terms — same variable, same power."
    */
    assert.equal(inferSkillTitle('How many apples are left?'), 'Number sense');
    assert.equal(inferSkillTitle('What is six plus two?'), 'Number sense');
    assert.equal(inferSkillTitle('Explain your answer'), 'Number sense');
    assert.equal(inferSkillTitle('There are 4 boxes on the day shelf'), 'Number sense');
  });

  it('still reads a real variable, attached to a coefficient or standing alone', () => {
    assert.equal(inferSkillTitle('Simplify 2x + 3y'), 'Algebra basics');
    assert.equal(inferSkillTitle('What does x mean here'), 'Algebra basics');
  });

  it('reaches the word-problem branch the algebra test used to swallow', () => {
    assert.equal(inferSkillTitle('A word problem about how many cookies'), 'Word problems');
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

describe('generatePracticeProblem', () => {
  it('returns a known arithmetic problem for a supported skill', () => {
    const problem = generatePracticeProblem('Order of operations');
    assert.equal(typeof problem, 'string');
    assert.ok(problem);
    assert.ok(inferSkillTitle(problem!));
  });

  it('returns null for non-arithmetic skills', () => {
    assert.equal(generatePracticeProblem('Number sense'), null);
    assert.equal(generatePracticeProblem('Word problems'), null);
  });
});
