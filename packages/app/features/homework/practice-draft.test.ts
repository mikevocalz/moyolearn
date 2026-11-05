// SOT: docs/work/pr-100/contract.md §Practice sets
// SOT-KEYWORDS: practice draft test skill tag classify ward key holder sheet html escape
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPracticeItem } from '@acme/student-model/pure';
import type { HomeworkQuestionView, HomeworkSubmissionView, QuestionOutcome } from './homework.types.ts';
import { buildPracticeDraft, canHoldPracticeKey, pickPracticeTags, practiceTagForText } from './practice-draft.ts';
import { PRACTICE_KEY_LABEL, PRACTICE_SHEET_LABEL, practiceSheetHtml } from './practice-sheet-html.ts';

const question = (
  orderIndex: number,
  text: string,
  outcome: QuestionOutcome,
  misconceptionTags: readonly string[] = [],
): HomeworkQuestionView => ({
  questionId: `q-${orderIndex}`,
  orderIndex,
  sourcePage: 1,
  sourceNumber: orderIndex + 1,
  currentRevision: 'r1',
  text,
  revisions: [],
  crop: null,
  outcome,
  attempts: 1,
  hintsUsed: 0,
  misconceptionTags,
  startedAt: null,
  completedAt: null,
});

const submission = (questions: readonly HomeworkQuestionView[]): HomeworkSubmissionView => ({
  submissionId: 'sub-1',
  learnerAuthId: 'kid-1',
  createdByAuthId: 'parent-1',
  subject: 'math',
  title: 'Fractions',
  instructions: '',
  localDate: '2026-10-15',
  status: 'complete',
  pipelineStatus: 'extracted',
  pipelineError: null,
  currentIndex: questions.length,
  currentQuestionId: questions[0]?.questionId ?? '',
  tutorSessionId: null,
  questions,
  createdAt: '2026-10-15T00:00:00.000Z',
  updatedAt: '2026-10-15T00:00:00.000Z',
});

test('question text maps to the skill its shape exercises', () => {
  assert.equal(practiceTagForText('What is 7 − 3?'), 'subtraction-within-20');
  assert.equal(practiceTagForText('7 + 8 ='), 'addition-within-20');
  assert.equal(practiceTagForText('342 + 189'), 'addition-multi-digit');
  assert.equal(practiceTagForText('6 x 7'), 'multiplication-facts');
  assert.equal(practiceTagForText('1/2 + 1/3'), 'fraction-addition');
  assert.equal(practiceTagForText('3/4 - 1/8'), 'fraction-subtraction');
  assert.equal(practiceTagForText('2/3 × 3/5'), 'fraction-multiplication');
  assert.equal(practiceTagForText('4.5 + 2.25'), 'decimal-sense');
  assert.equal(practiceTagForText('-4 + 7'), 'integer-operations');
  assert.equal(practiceTagForText('3 + 4 × 2'), 'order-of-operations');
  assert.equal(practiceTagForText('Solve for x: 3x + 4 = 19'), 'linear-two-step');
  assert.equal(practiceTagForText('x + 5 = 12'), 'equation-sense');
  assert.equal(practiceTagForText('2x + 1 = x + 6'), 'linear-both-sides');
});

test('a percent or word problem gets no guessed skill', () => {
  assert.equal(practiceTagForText('What is 20% of 50?'), null);
  assert.equal(practiceTagForText('Explain why the sky is blue.'), null);
});

test('misconceptions rank first; only help-needed outcomes count; capped at three', () => {
  const tags = pickPracticeTags([
    question(0, '9 + 8', 'solved-independently'),
    question(1, '13 − 5', 'supported-with-hints'),
    question(2, '1/2 + 1/4', 'attempted', ['adds-denominators']),
    question(3, '6 × 7', 'skipped'),
    question(4, '0.3 + 0.45', 'unresolved'),
    question(5, 'x + 3 = 9', 'unresolved'),
  ]);
  assert.deepEqual(tags, ['fraction-addition', 'subtraction-within-20', 'decimal-sense']);
});

test('the draft is a draft, seeded by its id, and every kept item verifies', () => {
  const sub = submission([question(0, '1/2 + 1/3', 'supported-with-hints')]);
  const first = buildPracticeDraft({ submission: sub, band: '6-8', practiceSetId: 'ps-1', now: 'now' });
  const again = buildPracticeDraft({ submission: sub, band: '6-8', practiceSetId: 'ps-1', now: 'now' });
  assert.deepEqual(first, again);
  assert.equal(first.view.status, 'draft');
  assert.equal(first.view.seed, 'ps-1');
  assert.equal(first.view.learnerAuthId, 'kid-1');
  assert.deepEqual(first.view.targetedTags, ['fraction-addition']);
  assert.ok(first.view.items.length > 0);
  for (const item of first.view.items) {
    assert.equal(item.skillTag, 'fraction-addition');
    assert.deepEqual(checkPracticeItem(item.prompt, item.answer), { ok: true });
  }
});

test('no recognised struggle falls back to band defaults and says so with empty targetedTags', () => {
  const draft = buildPracticeDraft({
    submission: submission([question(0, 'Explain photosynthesis', 'unresolved')]),
    band: 'k-2',
    practiceSetId: 'ps-2',
    now: 'now',
  });
  assert.deepEqual(draft.view.targetedTags, []);
  assert.ok(draft.view.items.length > 0);
});

test('only an active guardian holds the key: never the learner, never a revoked ward', () => {
  const guardian = { learnerId: 'parent-1', isLearner: false };
  assert.equal(canHoldPracticeKey(guardian, ['kid-1'], 'kid-1'), true);
  assert.equal(canHoldPracticeKey(guardian, [], 'kid-1'), false, 'revoked guardianship');
  assert.equal(canHoldPracticeKey(guardian, ['kid-2'], 'kid-1'), false, 'another family');
  assert.equal(canHoldPracticeKey({ learnerId: 'kid-1', isLearner: true }, ['kid-1'], 'kid-1'), false);
  assert.equal(canHoldPracticeKey({ learnerId: 'kid-1', isLearner: false }, ['kid-1'], 'kid-1'), false);
});

test('the sheet has no answers and the key has them, both labelled in words', () => {
  const draft = buildPracticeDraft({
    submission: submission([question(0, '13 − 5', 'supported-with-hints')]),
    band: 'k-2',
    practiceSetId: 'ps-3',
    now: 'now',
  }).view;
  const sheet = practiceSheetHtml(draft, 'sheet');
  const key = practiceSheetHtml(draft, 'key');
  assert.ok(sheet.includes(PRACTICE_SHEET_LABEL));
  assert.ok(key.includes(PRACTICE_KEY_LABEL));
  assert.ok(!sheet.includes('Answer:'));
  for (const item of draft.items) {
    assert.ok(!sheet.includes(`<strong>Answer:</strong>${item.answer}`));
    assert.ok(key.includes('<strong>Answer:</strong>'));
  }
  assert.ok(sheet.includes('break-inside:avoid'));
  assert.ok(!sheet.includes('window.print'), 'no toolbar unless asked');
  assert.ok(practiceSheetHtml(draft, 'sheet', { toolbar: true }).includes('window.print'));
});

test('every row value is escaped', () => {
  const hostile = {
    practiceSetId: 'ps-x',
    submissionId: 's',
    learnerAuthId: 'k',
    status: 'approved' as const,
    seed: 'ps-x',
    targetedTags: ['<img src=x onerror=alert(1)>'],
    items: [{ id: 'i', skillTag: '"><script>', prompt: '<b>1</b> & 2', answer: "'3'", checkerVersion: '<v>' }],
    createdAt: 'now',
  };
  for (const mode of ['sheet', 'key'] as const) {
    const html = practiceSheetHtml(hostile, mode);
    assert.ok(!html.includes('<img'));
    assert.ok(!html.includes('<script>'));
    assert.ok(!html.includes('<b>1</b>'));
    assert.ok(html.includes('&lt;b&gt;1&lt;/b&gt; &amp; 2'));
  }
});
