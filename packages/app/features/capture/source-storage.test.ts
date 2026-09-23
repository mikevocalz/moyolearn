// SOT-KEYWORDS: source provenance reload migration verification
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readProblemIsReading,
  writeProblem,
  writeProblemIsReading,
  type ProblemStorage,
} from './problem-storage.shared.ts';

test('legacy homework fails closed after reload; explicit typed origin survives', () => {
  const values = new Map<string, string>();
  const storage: ProblemStorage = {
    getString: (key) => values.get(key),
    set: (key, value) => {
      values.set(key, value);
    },
    remove: (key) => {
      values.delete(key);
    },
  };
  assert.equal(readProblemIsReading(storage), false);
  writeProblem(storage, '12 + 4');
  assert.equal(readProblemIsReading(storage), true);
  writeProblemIsReading(storage, false);
  assert.equal(readProblemIsReading(storage), false);
  writeProblemIsReading(storage, true);
  assert.equal(readProblemIsReading(storage), true);
});
