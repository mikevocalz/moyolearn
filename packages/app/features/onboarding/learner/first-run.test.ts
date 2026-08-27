// S22's gates, checked. The two that matter are the ones a child would feel:
// the subject cap refuses rather than silently rotating a pick out, and home is
// only reachable through the win.
// SOT: docs/pack/06-auth-onboarding-spec.md §5
// SOT-KEYWORDS: onboarding learner s22 first-run test gates cap win

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canAdvance,
  nextStep,
  previousStep,
  toggleSubject,
  winItem,
  EMPTY_LEARNER_DRAFT,
  FIRST_WIN,
  MAX_SUBJECTS,
  SUBJECT_TILES,
  type LearnerDraft,
  type SubjectId,
} from './steps.ts';

const draft = (over: Partial<LearnerDraft> = {}): LearnerDraft => ({
  ...EMPTY_LEARNER_DRAFT,
  ...over,
});

describe('S22 subject picking', () => {
  it('toggles off a subject already picked', () => {
    assert.deepEqual(toggleSubject(['math', 'science'], 'math'), ['science']);
  });

  it('refuses a pick over the cap instead of dropping the oldest', () => {
    const full: SubjectId[] = ['math', 'reading', 'writing'];
    assert.equal(full.length, MAX_SUBJECTS);
    assert.deepEqual(toggleSubject(full, 'science'), full);
  });

  it('will not advance with nothing picked', () => {
    assert.equal(canAdvance('subjects', draft()), false);
    assert.equal(canAdvance('subjects', draft({ subjects: ['math'] })), true);
  });
});

describe('S22 the tiny win', () => {
  it('asks about the first subject tapped', () => {
    assert.equal(winItem(draft({ subjects: ['science', 'math'] })), FIRST_WIN.science);
  });

  it('has a solvable item for every tile on the grid', () => {
    for (const tile of SUBJECT_TILES) {
      const item = FIRST_WIN[tile.id];
      assert.ok(item.choices[item.answerIndex], `${tile.id} answerIndex is off the end`);
      assert.match(item.notYet, /^Not yet/, `${tile.id} breaks the S10 error voice`);
    }
  });

  it('opens home only on a correct answer', () => {
    assert.equal(canAdvance('win', draft({ result: null })), false);
    assert.equal(canAdvance('win', draft({ result: 'not-yet' })), false);
    assert.equal(canAdvance('win', draft({ result: 'correct' })), true);
  });
});

describe('S22 step order', () => {
  it('runs avatar → hello → subjects → win and stops', () => {
    assert.equal(nextStep('avatar'), 'hello');
    assert.equal(nextStep('hello'), 'subjects');
    assert.equal(nextStep('subjects'), 'win');
    assert.equal(nextStep('win'), null);
    assert.equal(previousStep('avatar'), null);
    assert.equal(previousStep('hello'), 'avatar');
    assert.equal(previousStep('win'), 'subjects');
  });

  it('the avatar step is satisfiable by one tap and gates until it lands', () => {
    assert.equal(canAdvance('avatar', draft()), false);
    assert.equal(canAdvance('avatar', draft({ avatar: 'fox' })), true);
  });
});
