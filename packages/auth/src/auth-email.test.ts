// The sender's contract, asserted without a network. The expensive mistakes
// here are quiet ones: a half-configured sender that looks wired, a raw
// verification token handed to a third party, a recipient address written
// into a log line, and a failed send that nobody can grep for.
// SOT: docs/pack/06-auth-onboarding-spec.md §6 · docs/incidents/2026-09-22-login-lockout.md
// SOT-KEYWORDS: auth email test resend verification reset idempotency escaping sender config error class

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it, mock } from 'node:test';
import {
  AuthEmailSendError,
  escapeHtml,
  idempotencyKeyFor,
  readAuthEmailConfig,
  resetPasswordEmail,
  sendAuthEmail,
  sendResetPasswordEmailFor,
  sendVerificationEmailFor,
  verificationEmail,
  type AuthEmailConfig,
  type FetchLike,
} from './auth-email.ts';
import { learnerPlaceholderEmail } from './create-learner.ts';

const CONFIG: AuthEmailConfig = { apiKey: 're_test_key', from: 'Moyo <hello@moyolearn.com>' };

interface Captured {
  url: string;
  init: RequestInit;
}

/** A `fetch` that records the call and answers with whatever the test needs. */
function stubFetch(response: Response): { fetch: FetchLike; calls: Captured[] } {
  const calls: Captured[] = [];
  const fetch = (async (url, init) => {
    calls.push({ url: String(url), init: init ?? {} });
    return response;
  }) as FetchLike;
  return { fetch, calls };
}

const headerOf = (init: RequestInit, name: string): string | undefined =>
  (init.headers as Record<string, string> | undefined)?.[name];

const callback = (email: string | null, token = 'token-abc') => ({
  user: { id: 'user-1', email },
  url: 'https://moyolearn.com/api/auth/verify-email?token=t&callbackURL=%2Ftutor',
  token,
});

describe('reading the sender config', () => {
  it('is null when neither variable is set', () => {
    assert.equal(readAuthEmailConfig({}), null);
  });

  it('is null when only the api key is set — there is no safe default sender', () => {
    assert.equal(readAuthEmailConfig({ RESEND_API_KEY: 're_test_key' }), null);
  });

  it('is null when only the from address is set', () => {
    assert.equal(readAuthEmailConfig({ AUTH_EMAIL_FROM: 'hello@moyolearn.com' }), null);
  });

  it('treats blank and whitespace-only as missing, not as configured', () => {
    assert.equal(readAuthEmailConfig({ RESEND_API_KEY: '', AUTH_EMAIL_FROM: 'a@b.com' }), null);
    assert.equal(readAuthEmailConfig({ RESEND_API_KEY: '   ', AUTH_EMAIL_FROM: 'a@b.com' }), null);
    assert.equal(readAuthEmailConfig({ RESEND_API_KEY: 're_k', AUTH_EMAIL_FROM: '\t\n ' }), null);
  });

  it('trims both values', () => {
    assert.deepEqual(
      readAuthEmailConfig({ RESEND_API_KEY: '  re_k  ', AUTH_EMAIL_FROM: ' hello@moyolearn.com ' }),
      { apiKey: 're_k', from: 'hello@moyolearn.com' },
    );
  });

  it('never invents a from address', () => {
    const config = readAuthEmailConfig({
      RESEND_API_KEY: 're_k',
      AUTH_EMAIL_FROM: 'hello@moyolearn.com',
    });
    assert.equal(config?.from, 'hello@moyolearn.com');
  });
});

describe('the verification email', () => {
  const URL_WITH_SPECIALS =
    'https://moyolearn.com/api/auth/verify-email?token=abc&callbackURL=/tutor?q="x"';
  const message = verificationEmail('parent@example.com', URL_WITH_SPECIALS);

  it('is addressed and subjected for a human', () => {
    assert.equal(message.to, 'parent@example.com');
    assert.equal(message.subject, 'Confirm your email for Moyo');
  });

  it('carries the raw link in the text part', () => {
    assert.ok(message.text.includes(URL_WITH_SPECIALS));
  });

  it('escapes & and " so the href survives the ampersand and cannot be closed early', () => {
    assert.ok(message.html.includes('&amp;callbackURL='));
    assert.ok(message.html.includes('&quot;x&quot;'));
    assert.ok(!message.html.includes('?token=abc&callbackURL'));
    // The attribute must close exactly once, right after the escaped URL.
    assert.ok(message.html.includes(`<a href="${escapeHtml(URL_WITH_SPECIALS)}">`));
  });

  it('escapes & before the entities it introduces', () => {
    assert.equal(escapeHtml('a&b<c>"d"'), 'a&amp;b&lt;c&gt;&quot;d&quot;');
  });

  it('says the link expires and what to do if it was not asked for', () => {
    assert.ok(message.text.includes('one hour'));
    assert.ok(message.html.includes('one hour'));
    assert.ok(message.text.includes("If you didn't ask for it"));
  });
});

describe('the password reset email', () => {
  // Better Auth's own shape: the caller's redirectTo already folded in.
  const RESET_URL =
    'https://moyolearn.com/api/auth/reset-password/tok24?callbackURL=%2Freset-password&x="y"';
  const message = resetPasswordEmail('parent@example.com', RESET_URL);

  it('carries the Better Auth url untouched in the text part', () => {
    assert.equal(message.subject, 'Reset your Moyo password');
    assert.ok(message.text.includes(RESET_URL));
  });

  it('escapes the href like the verification mail does', () => {
    assert.ok(message.html.includes(`<a href="${escapeHtml(RESET_URL)}">`));
    assert.ok(!message.html.includes('&x="y"'));
  });
});

describe('the idempotency key', () => {
  // Three dot-separated segments, deliberately NOT a decodable JWT header.
  // A real-looking one here trips every credential scanner in CI forever,
  // and the function under test only ever hashes the string.
  const token = 'header.payload.signature';

  it('is stable for one (purpose, user, token), so a retry is the same send', () => {
    assert.equal(idempotencyKeyFor('verify', 'user-1', token), idempotencyKeyFor('verify', 'user-1', token));
  });

  it('differs between tokens, users and purposes', () => {
    const key = idempotencyKeyFor('verify', 'user-1', token);
    assert.notEqual(key, idempotencyKeyFor('verify', 'user-1', `${token}x`));
    assert.notEqual(key, idempotencyKeyFor('verify', 'user-2', token));
    assert.notEqual(key, idempotencyKeyFor('reset', 'user-1', token));
  });

  it('never carries the raw token — it is a credential, and the header is third-party', () => {
    const key = idempotencyKeyFor('verify', 'user-1', token);
    assert.ok(!key.includes(token));
    assert.ok(!key.includes('signature'));
    assert.equal(key, `verify-${createHash('sha256').update(`user-1:${token}`).digest('hex')}`);
  });
});

describe('sending', () => {
  it('POSTs the documented request shape to Resend, Idempotency-Key included', async () => {
    const { fetch, calls } = stubFetch(new Response('{"id":"1"}', { status: 200 }));
    const message = verificationEmail('parent@example.com', 'https://moyolearn.com/v?token=t');

    await sendAuthEmail(CONFIG, message, { purpose: 'verify', idempotencyKey: 'verify-abc', fetch });

    assert.equal(calls.length, 1);
    const call = calls[0];
    assert.ok(call);
    assert.equal(call.url, 'https://api.resend.com/emails');
    assert.equal(call.init.method, 'POST');
    assert.equal(headerOf(call.init, 'Authorization'), 'Bearer re_test_key');
    assert.equal(headerOf(call.init, 'Content-Type'), 'application/json');
    assert.equal(headerOf(call.init, 'Idempotency-Key'), 'verify-abc');
    assert.deepEqual(JSON.parse(String(call.init.body)), {
      from: 'Moyo <hello@moyolearn.com>',
      to: 'parent@example.com',
      subject: 'Confirm your email for Moyo',
      text: message.text,
      html: message.html,
    });
  });

  it('sends the derived key through the callback wrapper', async () => {
    const { fetch, calls } = stubFetch(new Response('{"id":"1"}', { status: 200 }));
    await sendVerificationEmailFor(CONFIG, callback('parent@example.com', 'tok'), { fetch });
    const call = calls[0];
    assert.ok(call);
    assert.equal(headerOf(call.init, 'Idempotency-Key'), idempotencyKeyFor('verify', 'user-1', 'tok'));
  });

  it('accepts the fetch seam on the config as well as on the call', async () => {
    const { fetch, calls } = stubFetch(new Response('', { status: 200 }));
    await sendAuthEmail({ ...CONFIG, fetch }, verificationEmail('p@example.com', 'https://x/v'), {
      purpose: 'verify',
      idempotencyKey: 'verify-abc',
    });
    assert.equal(calls.length, 1);
  });

  it('throws AuthEmailSendError on a non-ok response, naming the status', async () => {
    const { fetch } = stubFetch(
      new Response('{"message":"Domain is not verified","name":"validation_error"}', {
        status: 403,
      }),
    );

    await assert.rejects(
      sendAuthEmail(CONFIG, verificationEmail('parent@example.com', 'https://x/v'), {
        purpose: 'verify',
        idempotencyKey: 'verify-abc',
        fetch,
      }),
      (error: unknown) => {
        assert.ok(error instanceof AuthEmailSendError);
        assert.equal(error.name, 'AuthEmailSendError');
        assert.equal(error.status, 403);
        assert.equal(error.purpose, 'verify');
        assert.match(error.message, /HTTP 403/);
        assert.match(error.message, /Domain is not verified/);
        return true;
      },
    );
  });

  it('wraps an unreachable API in the same class, with status 0', async () => {
    const fetch = (async () => {
      throw new TypeError('fetch failed: ENOTFOUND api.resend.com');
    }) as FetchLike;

    await assert.rejects(
      sendAuthEmail(CONFIG, verificationEmail('p@example.com', 'https://x/v'), {
        purpose: 'reset',
        idempotencyKey: 'reset-abc',
        fetch,
      }),
      (error: unknown) => {
        assert.ok(error instanceof AuthEmailSendError);
        assert.equal(error.status, 0);
        assert.match(error.message, /could not be reached for the password reset email/);
        assert.ok(error.cause instanceof TypeError);
        return true;
      },
    );
  });

  it('keeps the recipient out of the thrown message, even when Resend quotes it back', async () => {
    const { fetch } = stubFetch(
      new Response('{"message":"Invalid `to` field: parent@example.com is not a mailbox"}', {
        status: 422,
      }),
    );

    await assert.rejects(
      sendAuthEmail(CONFIG, verificationEmail('parent@example.com', 'https://x/v'), {
        purpose: 'verify',
        idempotencyKey: 'verify-abc',
        fetch,
      }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.ok(!error.message.includes('parent@example.com'));
        assert.match(error.message, /\[recipient\]/);
        assert.match(error.message, /HTTP 422/);
        return true;
      },
    );
  });

  it('survives a non-JSON error body', async () => {
    const { fetch } = stubFetch(new Response('<html>502 Bad Gateway</html>', { status: 502 }));
    await assert.rejects(
      sendAuthEmail(CONFIG, verificationEmail('p@example.com', 'https://x/v'), {
        purpose: 'verify',
        idempotencyKey: 'verify-abc',
        fetch,
      }),
      /HTTP 502/,
    );
  });
});

describe('the callbacks Better Auth invokes', () => {
  it('never mail a learner placeholder — verification or reset', async () => {
    const { fetch, calls } = stubFetch(new Response('{"id":"1"}', { status: 200 }));
    const placeholder = learnerPlaceholderEmail('3f1c-uuid');

    assert.equal(await sendVerificationEmailFor(CONFIG, callback(placeholder), { fetch }), 'skipped-placeholder');
    assert.equal(await sendResetPasswordEmailFor(CONFIG, callback(placeholder), { fetch }), 'skipped-placeholder');
    assert.equal(calls.length, 0, 'no request may reach Resend for an @learners.invalid address');
  });

  it('send the reset mail to a real address under the reset purpose', async () => {
    const { fetch, calls } = stubFetch(new Response('{"id":"1"}', { status: 200 }));
    assert.equal(await sendResetPasswordEmailFor(CONFIG, callback('parent@example.com', 'tok'), { fetch }), 'sent');
    const call = calls[0];
    assert.ok(call);
    assert.equal(headerOf(call.init, 'Idempotency-Key'), idempotencyKeyFor('reset', 'user-1', 'tok'));
    assert.equal(JSON.parse(String(call.init.body)).subject, 'Reset your Moyo password');
  });

  it('log a failure under the stable class name, without the address, and rethrow', async (t) => {
    const logged = mock.method(console, 'error', () => {});
    t.after(() => logged.mock.restore());
    const { fetch } = stubFetch(
      new Response('{"message":"Invalid `to` field: parent@example.com"}', { status: 422 }),
    );

    await assert.rejects(
      sendVerificationEmailFor(CONFIG, callback('parent@example.com'), { fetch }),
      (error: unknown) => error instanceof AuthEmailSendError,
    );

    assert.equal(logged.mock.callCount(), 1);
    const line = logged.mock.calls[0]?.arguments ?? [];
    assert.match(String(line[0]), /verification email failed/);
    assert.ok(!JSON.stringify(line).includes('parent@example.com'));
    assert.deepEqual(line[1], { error: 'AuthEmailSendError', status: 422 });
  });
});
