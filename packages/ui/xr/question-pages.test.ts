import assert from 'node:assert/strict';
import { test } from 'node:test';
import { questionPages } from './question-pages.ts';

test('long homework and OCR tokens stay within the spatial window without losing characters', () => {
  const prompt = ('Explain 12345678901234567890123456789012345678901234567890 😊. ').repeat(60);
  const pages = questionPages(prompt);
  assert.ok(pages.length > 1);
  assert.equal(pages.join('').replaceAll('\n',''), prompt);
  for (const page of pages) {
    assert.ok(page.split('\n').length <= 12);
    for (const line of page.split('\n')) assert.ok(Array.from(line).length <= 42);
  }
});
test('blank lines are preserved, empty lessons still have a page, invalid geometry is rejected', () => {
  assert.deepEqual(questionPages('one\n\nthree'), ['one\n\nthree']);
  assert.deepEqual(questionPages(''), ['']);
  assert.throws(() => questionPages('text',0), RangeError);
});
