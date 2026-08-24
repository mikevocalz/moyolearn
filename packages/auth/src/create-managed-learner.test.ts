// The rollback is the point: a child account must never outlive a failed consent
// write. Doc 06 §2/§6.
// SOT: docs/pack/06-auth-onboarding-spec.md §2 §6
// SOT-KEYWORDS: test create learner rollback consent guardianship placeholder

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isPlaceholderEmail } from './create-learner.ts';
import { createManagedLearner, CreateLearnerError } from './create-managed-learner.ts';

const input = {
  guardianAuthId: 'g1',
  username: 'blue-otter',
  password: 'correcthorsebattery',
  displayName: 'Ada Lovelace',
  consent: { method: 'email-plus' as const, scope: 'tutoring', policyVersion: '2026-08-01' },
};

function writer(fail?: 'guardianship' | 'consent') {
  const calls: string[] = [];
  let created: { email: string } | null = null;
  return {
    calls,
    get created() {
      return created;
    },
    createUser: async (u: { email: string }) => {
      created = u;
      calls.push('createUser');
      return { id: 'learner-1' };
    },
    deleteUser: async () => {
      calls.push('deleteUser');
    },
    createGuardianship: async () => {
      calls.push('createGuardianship');
      if (fail === 'guardianship') throw new Error('db down');
    },
    createConsent: async () => {
      calls.push('createConsent');
      if (fail === 'consent') throw new Error('db down');
    },
  };
}

test('writes the learner, the guardianship and the consent', async () => {
  const w = writer();
  const { learnerAuthId } = await createManagedLearner(w, input);
  assert.equal(learnerAuthId, 'learner-1');
  assert.deepEqual(w.calls, ['createUser', 'createGuardianship', 'createConsent']);
});

test('the placeholder email is non-routable and carries nothing about the child', async () => {
  const w = writer();
  await createManagedLearner(w, input);
  const email = w.created!.email;
  assert.ok(isPlaceholderEmail(email));
  assert.ok(!email.includes('blue-otter'), 'must not embed the username');
  assert.ok(!email.toLowerCase().includes('ada'), 'must not embed the display name');
});

test('a failed consent write rolls the learner back', async () => {
  const w = writer('consent');
  await assert.rejects(() => createManagedLearner(w, input), CreateLearnerError);
  assert.deepEqual(w.calls, ['createUser', 'createGuardianship', 'createConsent', 'deleteUser']);
});

test('a failed guardianship write rolls the learner back too', async () => {
  const w = writer('guardianship');
  await assert.rejects(() => createManagedLearner(w, input), CreateLearnerError);
  assert.ok(w.calls.includes('deleteUser'));
});

test('invalid input never reaches the database', async () => {
  const w = writer();
  await assert.rejects(
    () => createManagedLearner(w, { ...input, consent: { ...input.consent, scope: '' } }),
    CreateLearnerError,
  );
  assert.deepEqual(w.calls, []);
});
