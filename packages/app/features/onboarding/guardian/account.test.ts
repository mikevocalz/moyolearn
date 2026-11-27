// The account step must CREATE an account. These tests hold the call: the
// draft email reaches Better Auth's sign-up, trimmed; a sign-up without a
// session is the verification notice and not a step forward; and the two codes
// a parent meets are named rather than passed through.
// SOT: docs/pack/06-auth-onboarding-spec.md §2 §5
// SOT-KEYWORDS: guardian account test sign up email verification better auth

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canLeaveAccountStep,
  createGuardianAccount,
  guardianAccountProblems,
  isGuardianAccountComplete,
  signInAfterVerification,
  type AuthClientResult,
  type GuardianAuthClient,
} from './account.ts';

interface Recorder extends GuardianAuthClient {
  calls: { signUp: unknown[]; signIn: unknown[]; resend: unknown[] };
}

function recorder(
  answers: {
    signUp?: AuthClientResult<{ token: string | null }>;
    signIn?: AuthClientResult<unknown>;
  } = {},
): Recorder {
  const calls = { signUp: [] as unknown[], signIn: [] as unknown[], resend: [] as unknown[] };
  return {
    calls,
    signUp: {
      async email(input) {
        calls.signUp.push(input);
        return answers.signUp ?? { data: { token: 'session-token' }, error: null };
      },
    },
    signIn: {
      async email(input) {
        calls.signIn.push(input);
        return answers.signIn ?? { data: {}, error: null };
      },
    },
    async sendVerificationEmail(input) {
      calls.resend.push(input);
      return { data: {}, error: null };
    },
  };
}

const draft = { name: 'Ada Lovelace', email: ' ada@example.com ', password: 'fixture-only-not-a-secret' };

describe('createGuardianAccount', () => {
  it('calls Better Auth sign-up with the draft email, trimmed, and the chosen password and name', async () => {
    const client = recorder();
    const outcome = await createGuardianAccount(client, draft, { callbackURL: 'moyo://onboarding/guardian' });
    assert.deepEqual(outcome, { kind: 'signed-in' });
    assert.deepEqual(client.calls.signUp, [
      {
        email: 'ada@example.com',
        password: 'fixture-only-not-a-secret',
        name: 'Ada Lovelace',
        callbackURL: 'moyo://onboarding/guardian',
      },
    ]);
  });

  it('reads a missing token as the verification gate, not as success', async () => {
    const client = recorder({ signUp: { data: { token: null }, error: null } });
    const outcome = await createGuardianAccount(client, draft);
    assert.deepEqual(outcome, { kind: 'verify-email', address: 'ada@example.com' });
  });

  it('names the way out for an existing account instead of echoing the server', async () => {
    const client = recorder({
      signUp: { data: null, error: { code: 'USER_ALREADY_EXISTS', message: 'User already exists' } },
    });
    const outcome = await createGuardianAccount(client, draft);
    assert.equal(outcome.kind, 'failed');
    if (outcome.kind === 'failed') {
      assert.equal(outcome.code, 'USER_ALREADY_EXISTS');
      assert.match(outcome.message, /Sign in instead/);
    }
  });

  it('refuses locally before calling the server when a field is wrong', async () => {
    const client = recorder();
    const outcome = await createGuardianAccount(client, { ...draft, password: 'short' });
    assert.equal(outcome.kind, 'failed');
    assert.equal(client.calls.signUp.length, 0);
  });
});

describe('signInAfterVerification', () => {
  it('keeps the notice up while the account is still unverified', async () => {
    const client = recorder({
      signIn: { data: null, error: { code: 'EMAIL_NOT_VERIFIED', message: 'Email not verified' } },
    });
    const outcome = await signInAfterVerification(client, { email: draft.email, password: draft.password });
    assert.deepEqual(outcome, { kind: 'verify-email', address: 'ada@example.com' });
  });

  it('is signed in once the link has been opened', async () => {
    const client = recorder();
    const outcome = await signInAfterVerification(client, { email: draft.email, password: draft.password });
    assert.deepEqual(outcome, { kind: 'signed-in' });
  });
});

describe('guardianAccountProblems', () => {
  it('validates each field on its own', () => {
    assert.deepEqual(guardianAccountProblems({ name: '', email: 'nope', password: 'short' }), {
      name: 'Tell us what to call you.',
      email: 'Enter the email you can read right now.',
      password: 'Twelve characters or more — length beats symbols.',
    });
    assert.equal(isGuardianAccountComplete(draft), true);
  });
});

describe('canLeaveAccountStep', () => {
  const blank = { name: '', email: '', password: '' };

  it('lets a signed-in guardian past with a fresh draft — the step shows them no fields to fill', () => {
    assert.equal(canLeaveAccountStep({ signedIn: true, live: true, account: blank }), true);
    assert.equal(canLeaveAccountStep({ signedIn: true, live: false, account: blank }), true);
  });

  it('holds a signed-out guardian until the name and email are there', () => {
    assert.equal(canLeaveAccountStep({ signedIn: false, live: false, account: blank }), false);
    assert.equal(canLeaveAccountStep({ signedIn: false, live: false, account: { ...draft, password: '' } }), true);
  });

  it('also needs the password in a live build, where Continue creates the account', () => {
    assert.equal(canLeaveAccountStep({ signedIn: false, live: true, account: { ...draft, password: 'short' } }), false);
    assert.equal(canLeaveAccountStep({ signedIn: false, live: true, account: draft }), true);
  });
});
