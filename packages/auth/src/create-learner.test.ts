// Doc 06 §2/§6: a learner may not exist without consent, and a learner username
// may not be identifying. Both are refusals, so both get a test.
// SOT: docs/pack/06-auth-onboarding-spec.md §2 §6
// SOT-KEYWORDS: test learner consent username password guardian

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  validateConsent,
  validateCreateLearner,
  validateLearnerPassword,
  validateLearnerUsername,
} from './create-learner.ts';

const consent = { method: 'email-plus' as const, scope: 'tutoring', policyVersion: '2026-08-01' };
const valid = {
  guardianAuthId: 'g1',
  username: 'blue-otter',
  password: 'correcthorsebattery',
  displayName: 'Ada',
  consent,
};

test('a learner username is never an email', () => {
  assert.equal(validateLearnerUsername('ada@example.com').ok, false);
});

test('a non-identifying handle passes', () => {
  assert.equal(validateLearnerUsername('blue-otter').ok, true);
});

test('short passwords are refused on length, not symbols', () => {
  assert.equal(validateLearnerPassword('Sh0rt!').ok, false);
  assert.equal(validateLearnerPassword('all lowercase and long').ok, true);
});

test('consent needs a policy version, because re-consent is versioned', () => {
  assert.equal(validateConsent({ ...consent, policyVersion: '' }).ok, false);
});

test('non email-plus methods must carry evidence', () => {
  assert.equal(validateConsent({ ...consent, method: 'kba' }).ok, false);
  assert.equal(validateConsent({ ...consent, method: 'kba', evidenceRef: 'kba-77' }).ok, true);
});

test('consent is checked before the credential, so a bad username cannot mask a missing consent', () => {
  const result = validateCreateLearner({ ...valid, username: 'x@y.com', consent: { ...consent, scope: '' } });
  assert.equal(result.ok, false);
  assert.match((result as { reason: string }).reason, /scope/);
});

test('a complete guardian-created learner passes', () => {
  assert.equal(validateCreateLearner(valid).ok, true);
});
