import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isOnWorksheetCursor, resumedProblem } from './resume-problem.ts';

const division = { questions: [{ questionId: 'q1' }, { questionId: 'q2' }], currentIndex: 0 };

test('the worksheet cursor\'s question drives coaching on resume, and the opener stays', () => {
  // Finished fractions, rolled over to a guardian's division sheet, reopened.
  const onCursor = isOnWorksheetCursor(division, { questionId: 'q1' });
  assert.equal(onCursor, true);
  assert.deepEqual(resumedProblem('3/4 + 1/8', '15 ÷ 3', onCursor), { opener: '3/4 + 1/8', coaching: '15 ÷ 3' });
});

test('a photographed reading with no worksheet identity resumes the thread as it was', () => {
  // The photo path sets the reading flag but carries no question evidence.
  const onCursor = isOnWorksheetCursor(division, null);
  assert.equal(onCursor, false);
  assert.deepEqual(resumedProblem('3/4 + 1/8', '42 ÷ 6', onCursor), { opener: '3/4 + 1/8', coaching: '3/4 + 1/8' });
});

test('evidence for a question the cursor has left does not win', () => {
  assert.equal(isOnWorksheetCursor(division, { questionId: 'q2' }), false);
  assert.equal(isOnWorksheetCursor(null, { questionId: 'q1' }), false);
});

test('an empty thread takes the device problem as both opener and coaching problem', () => {
  assert.deepEqual(resumedProblem('', '7 × 8', false), { opener: '7 × 8', coaching: '7 × 8' });
  assert.deepEqual(resumedProblem('3/4 + 1/8', '   ', true), { opener: '3/4 + 1/8', coaching: '3/4 + 1/8' });
});
