// The reload path for the handle that authorizes a grade.
// SOT-KEYWORDS: problem evidence question revision reload storage grading gate
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readProblemEvidence,
  writeProblemEvidence,
  type ProblemStorage,
} from './problem-storage.shared.ts';

const fakeStorage = (): ProblemStorage & { values: Map<string, string> } => {
  const values = new Map<string, string>();
  return {
    values,
    getString: (key) => values.get(key),
    set: (key, value) => {
      values.set(key, value);
    },
    remove: (key) => {
      values.delete(key);
    },
  };
};

test('an issued handle survives a reload and a malformed one reads as absent', () => {
  const storage = fakeStorage();
  assert.equal(readProblemEvidence(storage), null);

  writeProblemEvidence(storage, { questionId: 'question-1', revision: 'revision-2' });
  assert.deepEqual(readProblemEvidence(storage), {
    questionId: 'question-1',
    revision: 'revision-2',
  });

  writeProblemEvidence(storage, null);
  assert.equal(readProblemEvidence(storage), null);
});

test('nothing that is not exactly two well-formed ids reaches the grading request', () => {
  const storage = fakeStorage();

  // Written by hand into the same key — a corrupt record, an older format, or
  // a value someone put there. Every one of these must cost the learner one
  // ungraded turn rather than send a malformed pair to the write path.
  for (const raw of [
    '',
    'question-1',
    'question-1 revision-2 extra',
    'question 1 revision-2',
    'question-1 rev ision',
    `${'x'.repeat(129)} revision-2`,
    'question-1 revision/2',
  ]) {
    storage.set('capture-problem-evidence', raw);
    assert.equal(readProblemEvidence(storage), null, JSON.stringify(raw));
  }
});

test('an id the schema would refuse is never written', () => {
  const storage = fakeStorage();
  writeProblemEvidence(storage, { questionId: 'question-1', revision: 'revision-2' });

  // A rejected write CLEARS rather than leaving the previous pair in place.
  // Keeping it would attach a real, owned, current handle to a problem it does
  // not describe — which passes every server check and grades the wrong
  // question.
  writeProblemEvidence(storage, { questionId: 'has a space', revision: 'revision-3' });
  assert.equal(readProblemEvidence(storage), null);
});
