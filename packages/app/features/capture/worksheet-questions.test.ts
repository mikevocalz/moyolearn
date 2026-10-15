import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractWorksheetQuestions, questionForTutor } from './worksheet-questions.ts';

test('ten numbered math problems become ten ordered candidates, never one tutor prompt', () => {
  const source = Array.from({ length: 10 }, (_, i) => (i + 1) + '. ' + (i + 2) + ' + 3 =').join('\n');
  const result = extractWorksheetQuestions('Page 1:\nSolve each problem.\n' + source);
  assert.equal(result.questions.length, 10);
  assert.equal(result.questions[0]?.text, '2 + 3 =');
  assert.equal(result.questions[9]?.text, '11 + 3 =');
  assert.equal(result.questions[9]?.sourcePage, 1);
  assert.equal(result.instructions, 'Solve each problem.');
  const prompt = questionForTutor(result.questions[0]!, {
    subject: 'Math',
    instructions: result.instructions,
  });
  assert.match(prompt, /Subject: Math/);
  assert.match(prompt, /Question 1:/);
  assert.doesNotMatch(prompt, /11 \+ 3/);
});

test('multi-line handwriting and negative signs stay with the correct question', () => {
  const result = extractWorksheetQuestions(
    'Page 1:\n1) -4 + 3 =\nShow work under the question\n(-4) + (+3)\n2) 1/2 + 1/3 =',
  );
  assert.equal(result.questions.length, 2);
  assert.match(result.questions[0]!.text, /-4 \+ 3/);
  assert.match(result.questions[0]!.text, /Show work/);
  assert.equal(result.questions[1]!.text, '1/2 + 1/3 =');
});

test('page and file boundaries survive review', () => {
  const result = extractWorksheetQuestions('Page 1:\n1. 2+2\nPage 2:\n2. 9-5\nFile 3: more.pdf\n3. 8x2');
  assert.deepEqual(result.questions.map((q) => q.sourcePage), [1, 2, 3]);
});

test('two-column OCR may split but explicitly warns that the order needs checking', () => {
  const result = extractWorksheetQuestions('1) 7+1   2) 8+2\n3) 3-1');
  assert.equal(result.questions.length, 3);
  assert.match(result.warning ?? '', /order/);
});

test('unknown boundaries never fabricate multiple problems or call a source verified', () => {
  const result = extractWorksheetQuestions('8 + 9 =\n11 - 2 =\n7 x 4 =');
  assert.equal(result.questions.length, 1);
  assert.match(result.warning ?? '', /boundaries/);
  assert.equal(result.questions[0]?.sourceNumber, null);
});

test('nonconsecutive numbers remain visible and demand source review', () => {
  const result = extractWorksheetQuestions('1. 9+9\n3. 7+7');
  assert.equal(result.questions.length, 2);
  assert.ok(result.warning);
});

test('empty and too many questions fail closed', () => {
  assert.equal(extractWorksheetQuestions(' \n ').questions.length, 0);
  const oversized = Array.from({ length: 51 }, (_, i) => (i + 1) + '. x = ' + i).join('\n');
  assert.equal(extractWorksheetQuestions(oversized).questions.length, 0);
  assert.match(extractWorksheetQuestions(oversized).warning ?? '', /50/);
});
