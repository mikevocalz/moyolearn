// Doc 06 §6 names this test: "attempt to add email to a minor account = failing
// test". The restricted-account rule is the enforcement of §2's decision that a
// guardian-managed learner never carries an email and never resets itself.
// SOT: docs/pack/06-auth-onboarding-spec.md §2 §6
// SOT-KEYWORDS: auth test minor restricted guardian email

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isRestrictedLearnerUpdate } from './server.ts';

const managedLearner = { id: 'l1', guardianManaged: true, isMinor: true };
const adult = { id: 'a1', guardianManaged: false };

test('a managed learner cannot gain an email', () => {
  assert.equal(isRestrictedLearnerUpdate(managedLearner, { email: 'kid@example.com' }), true);
});

test('a managed learner cannot self-verify an email', () => {
  assert.equal(isRestrictedLearnerUpdate(managedLearner, { emailVerified: true }), true);
});

test('a managed learner can still have its display name changed', () => {
  assert.equal(isRestrictedLearnerUpdate(managedLearner, { name: 'Ada' }), false);
});

test('an adult account is untouched by the rule', () => {
  assert.equal(isRestrictedLearnerUpdate(adult, { email: 'grown@example.com' }), false);
});
