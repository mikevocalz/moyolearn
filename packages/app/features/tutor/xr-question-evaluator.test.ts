// The evaluator seam's one pure half: which drafts can become the wire's
// `answer` string, and which honestly cannot.
// SOT: packages/app/features/tutor/xr-question-evaluator.ts
// SOT-KEYWORDS: xr question evaluator draft answer wire expressible test

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { draftAnswerText, evaluateXrAnswer } from './xr-question-evaluator.ts';
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

/* These run against the web fork of `xr-local-tutor` — `xrLocalGrade` returns
   null, which is exactly the "local model could not decide" path a build
   without weights takes, so the escalation behaviour is what gets asserted. */

test('an unreachable server resolves ungraded instead of trapping the flow in error', async () => {
  const q: XrLearningQuestion = {
    ...question,
    evaluation: { kind: 'server-objective' },
    evidence: { questionId: 'q1', revision: 'r1' },
  };
  /* fetch to API_URL will fail in a test run — the evaluator must resolve
     honest feedback, never throw into `fail()`. */
  const feedback = await evaluateXrAnswer(q, { kind: 'choices', selectedIds: ['b'] });
  assert.equal(feedback.outcome, 'ungraded');
  assert.equal(feedback.title, 'Answered');
});

test('coach-review without a local verdict resolves to review copy, not a verdict', async () => {
  const q: XrLearningQuestion = { ...question, evaluation: { kind: 'coach-review' } };
  const feedback = await evaluateXrAnswer(q, { kind: 'choices', selectedIds: ['b'] });
  assert.equal(feedback.outcome, 'ungraded');
  assert.equal(feedback.title, 'Sent for review');
});

test('ungraded questions never claim correctness', async () => {
  const q: XrLearningQuestion = { ...question, evaluation: { kind: 'ungraded' } };
  const feedback = await evaluateXrAnswer(q, { kind: 'text', text: '3/4' });
  assert.equal(feedback.outcome, 'ungraded');
});
