// Preserve both source candidates when OCR misses embedded questions.
// SOT-KEYWORDS: homework pdf hybrid image source preservation regression
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { mergePdfCandidates } from './pdf-pages.ts';
it('retains the printed question and image answer when OCR omits the text layer', () => {
  const result = mergePdfCandidates('Question 1: add two and two', 'Answer: 5');
  assert.match(result, /Question 1: add two and two/);
  assert.match(result, /Answer: 5/);
});
it('does not duplicate a text layer already present in the image reading', () => {
  assert.equal(
    mergePdfCandidates('Question 1', 'Question 1\n2 + 2 = 5'),
    'Question 1\n2 + 2 = 5',
  );
});
it('does not correct an incorrect answer or drop text when OCR is empty', () => {
  assert.equal(mergePdfCandidates('2 + 2 = 5', ''), '2 + 2 = 5');
  assert.equal(mergePdfCandidates('', '2 + 2 = 5'), '2 + 2 = 5');
});
