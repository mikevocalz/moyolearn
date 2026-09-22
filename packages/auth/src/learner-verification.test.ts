// The learner half of the 2026-09-22 lockout. Two rules, both of which the
// incident proved are not obvious: a child's placeholder address is never
// mailed, and a managed learner is born verified — because nothing can ever
// verify it afterwards.
// SOT: docs/pack/06-auth-onboarding-spec.md §2 §6 · docs/incidents/2026-09-22-login-lockout.md
// SOT-KEYWORDS: learner verification test placeholder handoff username guardianManaged emailVerified

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sendVerificationEmailFor, type AuthEmailConfig, type FetchLike } from './auth-email.ts';
import { isPlaceholderEmail, learnerPlaceholderEmail } from './create-learner.ts';
import { isRestrictedLearnerUpdate } from './server.ts';
import { createPayloadLearnerWriter } from './payload-learner-writer.ts';

const CONFIG: AuthEmailConfig = { apiKey: 're_test_key', from: 'Moyo <hello@moyolearn.com>' };

function countingFetch(): { fetch: FetchLike; count: () => number } {
  let count = 0;
  const fetch = (async () => {
    count += 1;
    return new Response('{"id":"1"}', { status: 200 });
  }) as FetchLike;
  return { fetch, count: () => count };
}

const data = (email: string | null) => ({
  user: { email },
  url: 'https://moyolearn.com/api/auth/verify-email?token=t&callbackURL=%2Ftutor',
  token: 'token-abc',
});

describe('who gets a verification email', () => {
  it('never mails a learner placeholder — it is reserved-TLD and can only bounce', async () => {
    const { fetch, count } = countingFetch();
    const placeholder = learnerPlaceholderEmail('3f1c-uuid');
    assert.ok(isPlaceholderEmail(placeholder));

    const outcome = await sendVerificationEmailFor(CONFIG, data(placeholder), { fetch });

    assert.equal(outcome, 'skipped-placeholder');
    assert.equal(count(), 0, 'no request may reach Resend for an @learners.invalid address');
  });

  it('does not mail an account with no address at all', async () => {
    const { fetch, count } = countingFetch();
    assert.equal(await sendVerificationEmailFor(CONFIG, data(null), { fetch }), 'skipped-no-address');
    assert.equal(count(), 0);
  });

  it('does mail a real address', async () => {
    const { fetch, count } = countingFetch();
    assert.equal(
      await sendVerificationEmailFor(CONFIG, data('parent@example.com'), { fetch }),
      'sent',
    );
    assert.equal(count(), 1);
  });
});

describe('a managed learner is born verified', () => {
  /**
   * Records what `createUser` writes. Structural stand-ins for Better Auth and
   * Payload — the writer is an adapter, and what it passes to `updateUser` is
   * the entire behaviour under test.
   */
  function harness() {
    const updates: Array<{ id: string; fields: Record<string, unknown> }> = [];
    const auth = {
      api: {
        signUpEmail: async () => ({ user: { id: 'learner-1' } }),
      },
      $context: Promise.resolve({
        internalAdapter: {
          updateUser: async (id: string, fields: Record<string, unknown>) => {
            updates.push({ id, fields });
          },
          deleteUser: async () => {},
        },
      }),
    };
    const payload = { create: async () => ({}) };
    // The writer's port is structural; the real `Auth` type carries a Stripe
    // client and a pg Pool that this test has no business constructing.
    const writer = createPayloadLearnerWriter(
      auth as unknown as Parameters<typeof createPayloadLearnerWriter>[0],
      payload,
    );
    return { writer, updates };
  }

  it('sets emailVerified alongside the restricted flags, in one write', async () => {
    const { writer, updates } = harness();

    await writer.createUser({
      email: learnerPlaceholderEmail('3f1c-uuid'),
      password: 'correcthorsebattery',
      name: 'Ada',
      username: 'blue-otter',
    });

    assert.equal(updates.length, 1, 'one write, so the restricted hook sees a not-yet-managed row');
    const update = updates[0];
    assert.ok(update);
    assert.deepEqual(update.fields, {
      isMinor: true,
      guardianManaged: true,
      emailVerified: true,
    });
  });

  it('that write is not refused by the restricted-account hook', () => {
    /*
      The hook reads `existing` from `ctx?.context?.session?.user ?? {}`. An
      internalAdapter call carries no request and therefore no session, so
      `existing` is `{}` and `guardianManaged` is undefined — the rule declines
      to apply. This asserts the no-session case explicitly, because the fix in
      payload-learner-writer.ts depends on it and a future change to the hook
      that read the TARGET row instead would silently start refusing the write.
    */
    assert.equal(isRestrictedLearnerUpdate({}, { emailVerified: true }), false);
  });

  it('still refuses a managed learner self-verifying later', () => {
    assert.equal(
      isRestrictedLearnerUpdate({ guardianManaged: true }, { emailVerified: true }),
      true,
    );
  });
});
