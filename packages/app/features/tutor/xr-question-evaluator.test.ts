// The evaluator seam's one pure half: which drafts can become the wire's
// `answer` string, and which honestly cannot.
// SOT: packages/app/features/tutor/xr-question-evaluator.ts
// SOT-KEYWORDS: xr question evaluator draft answer wire expressible test

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { draftAnswerText } from './xr-question-evaluator.ts';
import type { XrLearningQuestion } from '@acme/ui/xr';

const question: XrLearningQuestion = {
  id: 'q1',
  subject: 'math',
  subjectLabel: 'MATH',
  uiLocale: 'en-US',
  questionLocale: 'en-US',
  textDirection: 'ltr',
  prompt: 'What is 1/2 + 1/4?',
  content: [],
  interaction: 'multiple-choice',
  choices: [
    { id: 'a', label: '1/4' },
    { id: 'b', label: '3/4' },
  ],
  source: 'practice',
  evaluation: { kind: 'server-objective' },
};

test('choice drafts carry the labels the child saw', () => {
  assert.equal(draftAnswerText(question, { kind: 'choices', selectedIds: ['b'] }), '3/4');
  assert.equal(draftAnswerText(question, { kind: 'choices', selectedIds: ['a', 'b'] }), '1/4, 3/4');
  assert.equal(draftAnswerText(question, { kind: 'choices', selectedIds: [] }), null);
});

test('text and expression drafts pass through, trimmed', () => {
  assert.equal(draftAnswerText(question, { kind: 'text', text: '  42  ' }), '42');
  assert.equal(draftAnswerText(question, { kind: 'expression', expression: ' 1/2 ' }), '1/2');
  assert.equal(draftAnswerText(question, { kind: 'text', text: '   ' }), null);
});

test('structured interactions the wire cannot express return null — the honest fallback', () => {
  assert.equal(draftAnswerText(question, { kind: 'labels', placements: [{ labelId: 'l', targetId: 't' }] }), null);
  assert.equal(draftAnswerText(question, { kind: 'ordering', order: ['a', 'b'] }), null);
  assert.equal(draftAnswerText(question, { kind: 'board', boardId: 'b' }), null);
  assert.equal(draftAnswerText(question, { kind: 'none' }), null);
});
