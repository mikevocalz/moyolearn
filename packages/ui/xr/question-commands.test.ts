import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  QUESTION_COMMAND,
  decodeQuestionCommand,
  phaseToRive,
} from './question-commands.ts';

test('every footer verb decodes to the intent it names', () => {
  assert.deepEqual(decodeQuestionCommand(QUESTION_COMMAND.submit, 0), { kind: 'submit' });
  assert.deepEqual(decodeQuestionCommand(QUESTION_COMMAND.next, 0), { kind: 'next' });
  assert.deepEqual(decodeQuestionCommand(QUESTION_COMMAND.requestHint, 0), { kind: 'requestHint' });
  assert.deepEqual(decodeQuestionCommand(QUESTION_COMMAND.startVoice, 0), { kind: 'startVoice' });
  assert.deepEqual(decodeQuestionCommand(QUESTION_COMMAND.openBoard, 0), { kind: 'openBoard' });
  assert.deepEqual(decodeQuestionCommand(QUESTION_COMMAND.retry, 0), { kind: 'retry' });
  assert.deepEqual(decodeQuestionCommand(QUESTION_COMMAND.skip, 0), { kind: 'skip' });
});

test('choice commands carry a validated row index', () => {
  assert.deepEqual(decodeQuestionCommand(QUESTION_COMMAND.selectChoice, 2), {
    kind: 'selectChoice', index: 2,
  });
  assert.deepEqual(decodeQuestionCommand(QUESTION_COMMAND.toggleChoice, 5), {
    kind: 'toggleChoice', index: 5,
  });
  /* A missing or negative arg is a dead button, never a wrong selection. */
  for (const bad of [-1, 0.5, Number.NaN]) {
    assert.deepEqual(decodeQuestionCommand(QUESTION_COMMAND.selectChoice, bad), { kind: 'none' });
    assert.deepEqual(decodeQuestionCommand(QUESTION_COMMAND.toggleChoice, bad), { kind: 'none' });
  }
});

test('anything outside the vocabulary decodes to none', () => {
  for (const bad of [-1, 10, 99, Number.NaN, Infinity]) {
    assert.deepEqual(decodeQuestionCommand(bad, 0), { kind: 'none' }, `command ${bad}`);
  }
  assert.deepEqual(decodeQuestionCommand(QUESTION_COMMAND.none, 0), { kind: 'none' });
});

test('phase mapping clamps to the authored 0..11 range', () => {
  assert.equal(phaseToRive(0), 0);
  assert.equal(phaseToRive(7), 7);
  assert.equal(phaseToRive(-3), 0);
  assert.equal(phaseToRive(99), 11);
  assert.equal(phaseToRive(3.7), 3);
});
