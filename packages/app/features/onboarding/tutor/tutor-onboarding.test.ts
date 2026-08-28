// S23's gates. The metric doc 06 §5 names for this screen is "availability
// completed", so the checks that matter are: availability arrives already
// passable, and the steps that claim to be optional really are.
// SOT: docs/pack/06-auth-onboarding-spec.md §5
// SOT-KEYWORDS: onboarding tutor s23 test gates availability optional credentials

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canAdvance,
  nextStep,
  slot,
  stepProgress,
  summariseSlots,
  toggleSlot,
  toggleSubject,
  DEFAULT_SLOTS,
  EMPTY_TUTOR_DRAFT,
  MAX_TEACHABLE,
  OPTIONAL_STEPS,
  STEP_DESTINATION,
  TUTOR_STEPS,
  type TeachableSubject,
  type TutorDraft,
} from './steps.ts';

const draft = (over: Partial<TutorDraft> = {}): TutorDraft => ({ ...EMPTY_TUTOR_DRAFT, ...over });

describe('S23 account', () => {
  it('takes Google without an email, and an email without Google', () => {
    assert.equal(canAdvance('account', draft({ google: true })), true);
    assert.equal(canAdvance('account', draft({ email: 'ada@example.com' })), true);
    assert.equal(canAdvance('account', draft()), false);
    assert.equal(canAdvance('account', draft({ email: 'ada@' })), false);
  });
});

describe('S23 profile', () => {
  const named = { displayName: 'Ada L.' };

  it('needs a name and at least one subject', () => {
    assert.equal(canAdvance('profile', draft({ ...named })), false);
    assert.equal(canAdvance('profile', draft({ subjects: ['math'] })), false);
    assert.equal(canAdvance('profile', draft({ ...named, subjects: ['math'] })), true);
  });

  it('never blocks on credentials — verification is a review path, not a gate', () => {
    assert.equal(
      canAdvance('profile', draft({ ...named, subjects: ['math'], credentials: [] })),
      true,
    );
  });

  it('caps teachable subjects instead of dropping the oldest pick', () => {
    const full: TeachableSubject[] = ['math', 'science', 'writing'];
    assert.equal(full.length, MAX_TEACHABLE);
    assert.deepEqual(toggleSubject(full, 'history'), full);
    assert.deepEqual(toggleSubject(full, 'math'), ['science', 'writing']);
  });
});

describe('S23 availability', () => {
  it('arrives already passable — the step is seeded, not empty', () => {
    assert.ok(DEFAULT_SLOTS.length > 0);
    assert.equal(canAdvance('availability', draft()), true);
  });

  it('is the one step that cannot be emptied and waved through', () => {
    assert.equal(canAdvance('availability', draft({ slots: [] })), false);
  });

  it('toggles a slot both ways', () => {
    const id = slot('Sat', 'morning');
    assert.ok(toggleSlot(DEFAULT_SLOTS, id).includes(id));
    assert.ok(!toggleSlot(toggleSlot(DEFAULT_SLOTS, id), id).includes(id));
  });

  it('summarises by day, not by raw count alone', () => {
    assert.equal(summariseSlots([]), 'No times yet');
    assert.equal(summariseSlots(['Mon-afternoon']), '1 block across Mon');
    assert.equal(summariseSlots(['Mon-afternoon', 'Fri-evening']), '2 blocks across Mon, Fri');
  });
});

describe('S23 shape', () => {
  it('lets connect be skipped, and says what skipping costs', () => {
    assert.equal(canAdvance('connect', draft()), true);
    assert.ok(OPTIONAL_STEPS.connect);
  });

  it('does not offer a skip on any gated step', () => {
    for (const step of TUTOR_STEPS) {
      if (!OPTIONAL_STEPS[step]) continue;
      assert.equal(canAdvance(step, draft()), true, `${step} offers a skip it cannot honour`);
    }
  });

  it('labels every forward button with a destination', () => {
    for (const step of TUTOR_STEPS) assert.ok(STEP_DESTINATION[step]);
    assert.equal(nextStep('availability'), null);
    assert.deepEqual(stepProgress('availability'), { index: 4, total: 4 });
  });

  it('puts the invite code before the profile — doc 37 §2 order', () => {
    assert.deepEqual(TUTOR_STEPS, ['account', 'connect', 'profile', 'availability']);
    assert.equal(nextStep('account'), 'connect');
    assert.equal(nextStep('connect'), 'profile');
  });

  // Doc 37 §1.2/§2: the session-notes explainer moved to the first Notes visit
  // (the `tutor-notes` CoachMark). The flow must not teach it twice.
  it('ends at availability — no front-loaded preview step', () => {
    assert.equal(TUTOR_STEPS.at(-1), 'availability');
    assert.ok(!(TUTOR_STEPS as readonly string[]).includes('preview'));
  });
});
