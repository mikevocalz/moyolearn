import assert from 'node:assert/strict';
import { test } from 'node:test';
import { interactionSupported, SUBJECT_CAPABILITIES } from './question-capabilities.ts';
import { XR_QUESTION_FIXTURES } from './question-fixtures.ts';
import type { LearningSubject, QuestionInteraction } from './question-contract.ts';

test("every fixture's interaction is at least a fallback for its subject", () => {
  for (const f of XR_QUESTION_FIXTURES) {
    const support = interactionSupported(f.subject, f.interaction);
    assert.notEqual(support, 'unsupported', `${f.id}: ${f.subject}/${f.interaction}`);
  }
});

test('the rail interactions are full everywhere — the baseline contract', () => {
  for (const subject of Object.keys(SUBJECT_CAPABILITIES) as LearningSubject[]) {
    assert.equal(interactionSupported(subject, 'multiple-choice'), 'full', subject);
    assert.equal(interactionSupported(subject, 'true-false'), 'full', subject);
  }
});

test('an interaction a subject cannot express is declined, not faked', () => {
  /* Reading has no numeric composer in its set — it falls back or declines. */
  const r = interactionSupported('reading', 'numeric');
  assert.ok(r === 'fallback' || r === 'unsupported');
});

test('the table covers every subject and interaction name in the contract', () => {
  const subjects: LearningSubject[] = [
    'math', 'science', 'english-language-arts', 'reading', 'writing',
    'social-studies', 'history', 'geography', 'computer-science',
    'world-language', 'other',
  ];
  const interactions: QuestionInteraction[] = [
    'multiple-choice', 'multi-select', 'short-text', 'long-text', 'numeric',
    'expression', 'true-false', 'ordering', 'matching', 'diagram-label',
    'board-work', 'voice', 'tutor-conversation',
  ];
  for (const s of subjects) {
    assert.ok(SUBJECT_CAPABILITIES[s], s);
    for (const i of interactions) {
      assert.notEqual(interactionSupported(s, i), undefined, `${s}/${i}`);
    }
  }
});
