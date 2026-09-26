// SOT-KEYWORDS: assessment source readiness offline grading regression
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readyForEvaluation,
  readinessForTurn,
} from './assessment-readiness.ts';

test('missing, failed, and unrecognized source states cannot enable grading', () => {
  for (const state of [
    undefined,
    '',
    'ready',
    'unresolved',
    'processing',
    'failed',
  ]) {
    assert.equal(readyForEvaluation(state), false);
  }
});

test('recognition in either the problem or answer prevents assessment', () => {
  for (const problemIsReading of [false, true]) {
    for (const hasRecognizedInput of [false, true]) {
      const readiness = readinessForTurn({
        problemIsReading,
        hasRecognizedInput,
      });
      assert.equal(
        readyForEvaluation(readiness),
        !problemIsReading && !hasRecognizedInput,
      );
    }
  }
});
