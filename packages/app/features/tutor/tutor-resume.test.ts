import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumedProblem } from './resume-problem.ts';

test('a worksheet question on this device outranks the resumed thread\'s first problem', () => {
  // Finished fractions, rolled over to a guardian's division sheet, reopened.
  assert.equal(resumedProblem('3/4 + 1/8', '15 ÷ 3', true), '15 ÷ 3');
});

test('a typed or photographed problem resumes the thread as it was', () => {
  assert.equal(resumedProblem('3/4 + 1/8', 'something else', false), '3/4 + 1/8');
  assert.equal(resumedProblem('3/4 + 1/8', '', false), '3/4 + 1/8');
  assert.equal(resumedProblem('3/4 + 1/8', '   ', true), '3/4 + 1/8');
});

test('an empty thread takes the device problem as its seed', () => {
  assert.equal(resumedProblem('', '7 × 8', false), '7 × 8');
});
