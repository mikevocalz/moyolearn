import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canRevisePriorWork, homeworkQuestionCounts, nextUndoneIndex } from './homework-prior-work.ts';

describe('prior-work cursor selection', () => {
  it('opens the first unmarked question, including legacy records', () => {
    assert.equal(nextUndoneIndex([{ priorWork: 'complete' }, { priorWork: 'complete' }, {}]), 2);
    assert.equal(nextUndoneIndex([{}, {}]), 0);
    assert.equal(nextUndoneIndex([{ priorWork: 'partial' }]), 0);
  });

  it('skips interior marked questions without reordering the worksheet', () => {
    const questions = [{}, { priorWork: 'complete' as const }, { priorWork: 'partial' as const }];
    assert.equal(nextUndoneIndex(questions, 0), 2);
    assert.equal(nextUndoneIndex(questions, 2), -1);
    assert.equal(questions.length, 3);
  });

  it('detects an all-done sheet and reopens an unticked question', () => {
    assert.equal(nextUndoneIndex([{ priorWork: 'complete' }, { priorWork: 'complete' }]), -1);
    assert.equal(nextUndoneIndex([{ priorWork: 'complete' }, { priorWork: 'none' }]), 1);
  });
});

describe('timeline prior-work counts', () => {
  it('counts marked problems separately while preserving the worksheet total', () => {
    const counts = homeworkQuestionCounts([
      { priorWork: 'complete', outcome: 'unattempted' },
      { priorWork: 'complete', outcome: 'solved-independently' },
      { priorWork: 'none', outcome: 'unattempted' },
      { priorWork: 'partial', outcome: 'supported-with-hints' },
    ]);
    assert.equal(counts.questionCount, 4);
    assert.equal(counts.alreadyDoneCount, 2);
    assert.equal(counts.outcomes.unattempted, 1);
    assert.equal(counts.outcomes['solved-independently'], 0);
    assert.equal(counts.outcomes['supported-with-hints'], 1);
    assert.equal(Object.values(counts.outcomes).reduce((sum, count) => sum + count, 0), 2);
  });
});

describe('prestart guardian revision boundary', () => {
  const untouched = [{ outcome: 'unattempted' as const, startedAt: null }];
  it('allows ready and all-marked prestart sheets', () => {
    assert.equal(canRevisePriorWork({ status: 'ready', tutorSessionId: null }, untouched), true);
    assert.equal(canRevisePriorWork({ status: 'complete', tutorSessionId: null }, untouched), true);
  });

  it('denies active, abandoned, attempted and previously started sheets', () => {
    assert.equal(canRevisePriorWork({ status: 'in-progress' }, untouched), false);
    assert.equal(canRevisePriorWork({ status: 'abandoned' }, untouched), false);
    assert.equal(canRevisePriorWork({ status: 'ready', tutorSessionId: 'session' }, untouched), false);
    assert.equal(canRevisePriorWork({ status: 'complete' }, [{ outcome: 'attempted' }]), false);
    assert.equal(canRevisePriorWork({ status: 'ready' }, [{ outcome: 'unattempted', startedAt: '2026-11-14' }]), false);
  });
});
