import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeXrQuestion } from './question-normalize.ts';
import { XR_QUESTION_FIXTURES } from './question-fixtures.ts';

test('a good payload round-trips whole', () => {
  for (const fixture of XR_QUESTION_FIXTURES) {
    const { question, droppedBlocks } = normalizeXrQuestion(JSON.parse(JSON.stringify(fixture)));
    assert.ok(question, `${fixture.id} normalized`);
    assert.equal(question.id, fixture.id);
    assert.equal(question.content.length, fixture.content.length, `${fixture.id} kept its blocks`);
    assert.equal(droppedBlocks, 0);
  }
});

test('a payload without id or prompt is dropped, not half-rendered', () => {
  assert.equal(normalizeXrQuestion({ prompt: 'x' }).question, null);
  assert.equal(normalizeXrQuestion({ id: 'x' }).question, null);
  assert.equal(normalizeXrQuestion('not an object').question, null);
  assert.equal(normalizeXrQuestion(null).question, null);
});

test('unknown block types drop and count, the rest survive', () => {
  const { question, droppedBlocks } = normalizeXrQuestion({
    id: 'q', prompt: 'p', interaction: 'multiple-choice', subject: 'math',
    content: [
      { type: 'text', text: 'fine' },
      { type: 'hologram', text: 'invented' },
      { type: 'image' }, // missing source
      { type: 'heading', text: 'also fine' },
    ],
  });
  assert.ok(question);
  assert.equal(question.content.length, 2);
  assert.equal(droppedBlocks, 2);
});

test('defaults are honest: unknown subject/interaction/direction fall back', () => {
  const { question } = normalizeXrQuestion({
    id: 'q', prompt: 'p', subject: 'alchemy', interaction: 'telepathy',
    textDirection: 'sideways', content: [],
  });
  assert.ok(question);
  assert.equal(question.subject, 'other');
  assert.equal(question.interaction, 'multiple-choice');
  assert.equal(question.textDirection, 'ltr');
});

test('evidence survives only as a complete pair', () => {
  const half = normalizeXrQuestion({
    id: 'q', prompt: 'p', content: [], evaluation: { kind: 'server-objective' },
    evidence: { questionId: 'a' },
  });
  assert.equal(half.question?.evidence, undefined);
  const whole = normalizeXrQuestion({
    id: 'q', prompt: 'p', content: [], evaluation: { kind: 'server-objective' },
    evidence: { questionId: 'a', revision: 'r1' },
  });
  assert.deepEqual(whole.question?.evidence, { questionId: 'a', revision: 'r1' });
});

test('no answer-key field exists to smuggle through', () => {
  const { question } = normalizeXrQuestion({
    id: 'q', prompt: 'p', content: [], correct: 1, answer: 'x', solution: 'y',
  });
  assert.ok(question);
  assert.ok(!('correct' in question) && !('answer' in question) && !('solution' in question));
});
