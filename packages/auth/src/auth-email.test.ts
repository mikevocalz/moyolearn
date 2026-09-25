// The sender's contract, asserted without a network. The expensive mistakes
// here are quiet ones: a half-configured sender that looks wired, a raw
// token handed to a third party, a recipient address written into a log line,
// and a reset failure logged under the verification flow's name.
// SOT: docs/pack/06-auth-onboarding-spec.md §6 · docs/decisions/2026-09-23-reset-password-contract.md · docs/incidents/2026-09-22-login-lockout.md
// SOT-KEYWORDS: auth email test resend verification password reset idempotency escaping sender config

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
  sendResetPasswordFor,
  sendVerificationEmailFor,
  verificationEmail,
  type AuthEmailConfig,
  type FetchLike,
} from './auth-email.ts';
import { learnerPlaceholderEmail } from './create-learner.ts';
import { createAuth } from './server.ts';

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

describe('the idempotency key', () => {
  // Three dot-separated segments, deliberately NOT a decodable JWT header.
  // A real-looking one here trips every credential scanner in CI forever,
  // and the function under test only ever hashes the string.
  const token = 'header.payload.signature';

  it('is stable for one token, so a retry is the same send', () => {
    assert.equal(
      idempotencyKeyFor(token, 'verification'),
      idempotencyKeyFor(token, 'verification'),
    );
    assert.equal(
      idempotencyKeyFor(token, 'password-reset'),
      idempotencyKeyFor(token, 'password-reset'),
    );
  });

  it('differs between tokens', () => {
    assert.notEqual(
      idempotencyKeyFor(token, 'verification'),
      idempotencyKeyFor(`${token}x`, 'verification'),
    );
  });

  it('never carries the raw token — it is a credential, and the header is third-party', () => {
    const key = idempotencyKeyFor(token, 'verification');
    assert.ok(!key.includes(token));
    assert.ok(!key.includes('signature'));
    assert.equal(key, `verify-${createHash('sha256').update(token).digest('hex')}`);
  });

  it('gives the reset its own prefix, because Resend keys are account-global', () => {
    const key = idempotencyKeyFor(token, 'password-reset');
    assert.equal(key, `reset-${createHash('sha256').update(token).digest('hex')}`);
    assert.ok(!key.includes(token));
  });

  /*
    The two token spaces come from different generators and will not collide by
    themselves. The prefix is what guarantees it, and this is the assertion that
    fails if someone drops it: an account-global key reused across flows means
    Resend answers the second send with the first send's result.
  */
  it('never collides across kinds for one token', () => {
    assert.notEqual(
      idempotencyKeyFor(token, 'verification'),
      idempotencyKeyFor(token, 'password-reset'),
    );
  });
});

describe('sending', () => {
  it('POSTs the documented request shape to Resend', async () => {
    const { fetch, calls } = stubFetch(new Response('{"id":"1"}', { status: 200 }));
    const message = verificationEmail('parent@example.com', 'https://moyolearn.com/v?token=t');

    await sendAuthEmail(CONFIG, message, { idempotencyKey: 'verify-abc', fetch });

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

  it('accepts the fetch seam on the config as well as on the call', async () => {
    const { fetch, calls } = stubFetch(new Response('', { status: 200 }));
    await sendAuthEmail({ ...CONFIG, fetch }, verificationEmail('p@example.com', 'https://x/v'), {
      idempotencyKey: 'verify-abc',
    });
    assert.equal(calls.length, 1);
  });

  it('throws on a non-ok response and names the status', async () => {
    const { fetch } = stubFetch(
      new Response('{"message":"Domain is not verified","name":"validation_error"}', {
        status: 403,
      }),
    );

    await assert.rejects(
      sendAuthEmail(CONFIG, verificationEmail('parent@example.com', 'https://x/v'), {
        idempotencyKey: 'verify-abc',
        fetch,
      }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /HTTP 403/);
        assert.match(error.message, /Domain is not verified/);
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
        idempotencyKey: 'verify-abc',
        fetch,
      }),
      /HTTP 502/,
    );
  });

  it('throws AuthEmailSendError carrying the kind and status', async () => {
    const { fetch } = stubFetch(new Response('{"message":"rate limited"}', { status: 429 }));
    await assert.rejects(
      sendAuthEmail(CONFIG, resetPasswordEmail('p@example.com', 'https://x/r'), {
        idempotencyKey: 'reset-abc',
        fetch,
      }),
      (error: unknown) => {
        assert.ok(error instanceof AuthEmailSendError);
        assert.equal(error.name, 'AuthEmailSendError');
        assert.equal(error.kind, 'password-reset');
        assert.equal(error.status, 429);
        return true;
      },
    );
  });

  /*
    A DNS or TLS failure used to escape as a bare `TypeError: fetch failed`,
    which names neither the flow nor the provider in a log line.
  */
  it('wraps an unreachable API in the same class, with status 0', async () => {
    const fetch = (async () => {
      throw new TypeError('fetch failed: ENOTFOUND api.resend.com');
    }) as FetchLike;

    await assert.rejects(
      sendAuthEmail(CONFIG, verificationEmail('p@example.com', 'https://x/v'), {
        idempotencyKey: 'verify-abc',
        fetch,
      }),
      (error: unknown) => {
        assert.ok(error instanceof AuthEmailSendError);
        assert.equal(error.status, 0);
        assert.match(error.message, /could not be reached for the verification email/);
        assert.ok(error.cause instanceof TypeError);
        return true;
      },
    );
  });

  it('logs a callback failure under the stable class name, without the address, and rethrows', async (t) => {
    const logged = mock.method(console, 'error', () => {});
    t.after(() => logged.mock.restore());
    const { fetch } = stubFetch(
      new Response('{"message":"Invalid `to` field: parent@example.com"}', { status: 422 }),
    );

    await assert.rejects(
      sendVerificationEmailFor(
        CONFIG,
        { user: { id: 'user-1', email: 'parent@example.com' }, url: 'https://x/v', token: 'tok' },
        { fetch },
      ),
      (error: unknown) => error instanceof AuthEmailSendError,
    );

    assert.equal(logged.mock.callCount(), 1);
    const line = logged.mock.calls[0]?.arguments ?? [];
    assert.match(String(line[0]), /verification email failed for user user-1/);
    assert.ok(!JSON.stringify(line).includes('parent@example.com'));
    assert.deepEqual(line[1], { error: 'AuthEmailSendError', kind: 'verification', status: 422 });
  });
});

describe('the password-reset email', () => {
  /*
    A real reset link carries one query parameter and better-auth
    percent-encodes its value, so neither `&` nor `"` survives into it. Both are
    here anyway: the escaping is what stops a future caller — or a `baseURL`
    someone typed by hand — from truncating the href at the first quote and
    mailing out a dead link nobody can diagnose from the rendered mail.
  */
  const RESET_URL =
    'https://moyolearn.com/api/auth/reset-password/tok?callbackURL=/reset&next="/tutor"';
  const message = resetPasswordEmail('parent@example.com', RESET_URL);

  it('is addressed and subjected for a human', () => {
    assert.equal(message.to, 'parent@example.com');
    assert.equal(message.subject, 'Reset your Moyo password');
  });

  it('carries the raw link in the text part', () => {
    assert.ok(message.text.includes(RESET_URL));
  });

  it('escapes & and " so the href survives and cannot be closed early', () => {
    assert.ok(message.html.includes('&amp;next='));
    assert.ok(message.html.includes('&quot;/tutor&quot;'));
    assert.ok(!message.html.includes('/reset&next'));
    assert.ok(message.html.includes(`<a href="${escapeHtml(RESET_URL)}">`));
  });

  it('says what arrived, what to do, how long it lasts, and what ignoring it costs', () => {
    for (const part of [message.text, message.html]) {
      assert.ok(part.includes('Someone asked to reset the password'));
      assert.ok(part.includes('set a new one here'));
      assert.ok(part.includes('one hour'));
      assert.ok(part.includes('your password stays as it is'));
    }
  });

  /*
    Asking for a reset is a supported way back in, not a mistake, and the
    endpoint answers identically whether the address has an account or not.
    Copy that apologised or warned would both blame the reader and hint at an
    account the response deliberately refuses to confirm.
  */
  it('does not treat the request as an error or a warning', () => {
    assert.doesNotMatch(message.text, /error|problem|sorry|warning|unfortunately/i);
    assert.doesNotMatch(message.subject, /error|problem|sorry|warning|unfortunately/i);
  });
});

describe('sending a password reset', () => {
  const data = (email: string | null) => ({
    user: { email },
    url: 'https://moyolearn.com/api/auth/reset-password/tok?callbackURL=%2Freset',
    token: 'reset-token-abc',
  });

  it('POSTs the reset message under the reset idempotency prefix', async () => {
    const { fetch, calls } = stubFetch(new Response('{"id":"1"}', { status: 200 }));

    assert.equal(await sendResetPasswordFor(CONFIG, data('parent@example.com'), { fetch }), 'sent');

    assert.equal(calls.length, 1);
    const call = calls[0];
    assert.ok(call);
    assert.equal(call.url, 'https://api.resend.com/emails');
    assert.equal(call.init.method, 'POST');
    assert.equal(headerOf(call.init, 'Authorization'), 'Bearer re_test_key');
    assert.equal(headerOf(call.init, 'Content-Type'), 'application/json');
    assert.equal(
      headerOf(call.init, 'Idempotency-Key'),
      idempotencyKeyFor('reset-token-abc', 'password-reset'),
    );
    const expected = resetPasswordEmail('parent@example.com', data(null).url);
    assert.deepEqual(JSON.parse(String(call.init.body)), {
      from: 'Moyo <hello@moyolearn.com>',
      to: 'parent@example.com',
      subject: 'Reset your Moyo password',
      text: expected.text,
      html: expected.html,
    });
  });

  /*
    The guard that reads as though it covers this one does not.
    `isRestrictedLearnerPasswordChange` requires `actorId === owner.id`, and
    `/reset-password` carries no session, so it declines and the password change
    goes through. Refusing the send is the control that is actually available,
    and doc 06 §2 requires one: a managed learner's recovery runs through the
    guardian, never through `<uuid>@learners.invalid`.
  */
  it('never mails a learner placeholder — the reset would bypass the guardian', async () => {
    const { fetch, calls } = stubFetch(new Response('{"id":"1"}', { status: 200 }));
    const placeholder = learnerPlaceholderEmail('3f1c-uuid');

    assert.equal(
      await sendResetPasswordFor(CONFIG, data(placeholder), { fetch }),
      'skipped-placeholder',
    );
    assert.equal(calls.length, 0, 'no request may reach Resend for an @learners.invalid address');
  });

  it('does not mail an account with no address at all', async () => {
    const { fetch, calls } = stubFetch(new Response('{"id":"1"}', { status: 200 }));
    assert.equal(await sendResetPasswordFor(CONFIG, data(null), { fetch }), 'skipped-no-address');
    assert.equal(calls.length, 0);
  });

  /*
    The label used to be hardcoded to "the verification email". Reusing the
    sender as it stood would have filed every reset failure under the flow that
    did not fail, which is the kind of log line that costs an afternoon.
  */
  it('names the reset flow when Resend rejects it, not verification', async () => {
    const { fetch } = stubFetch(
      new Response('{"message":"Domain is not verified","name":"validation_error"}', {
        status: 403,
      }),
    );

    await assert.rejects(sendResetPasswordFor(CONFIG, data('parent@example.com'), { fetch }), (
      error: unknown,
    ) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /password reset email/);
      assert.doesNotMatch(error.message, /verification email/);
      assert.match(error.message, /HTTP 403/);
      return true;
    });
  });

  it('keeps the recipient out of the thrown message, even when Resend quotes it back', async () => {
    const { fetch } = stubFetch(
      new Response('{"message":"Invalid `to` field: parent@example.com is not a mailbox"}', {
        status: 422,
      }),
    );

    await assert.rejects(sendResetPasswordFor(CONFIG, data('parent@example.com'), { fetch }), (
      error: unknown,
    ) => {
      assert.ok(error instanceof Error);
      assert.ok(!error.message.includes('parent@example.com'));
      assert.match(error.message, /\[recipient\]/);
      assert.match(error.message, /HTTP 422/);
      return true;
    });
  });
});

describe('the reset sender as better-auth sees it', () => {
  /**
   * `createAuth` reads the sender config from `process.env` at call time, so the
   * only way to exercise both branches is to set it. Restored afterwards because
   * the runner shares one process across the describes in this file.
   *
   * The connection string is a dead address on purpose: `new Pool()` does not
   * dial until a query runs, and none of these assertions reaches the database.
   */
  function withEnv(vars: Record<string, string | undefined>, run: () => void): void {
    const previous = Object.fromEntries(Object.keys(vars).map((key) => [key, process.env[key]]));
    // `process.env.X = undefined` stores the string "undefined", which reads as
    // configured. Unsetting is a delete, both here and on the way back.
    const apply = (entries: Record<string, string | undefined>): void => {
      for (const [key, value] of Object.entries(entries)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    };
    apply(vars);
    try {
      run();
    } finally {
      apply(previous);
    }
  }

  const boot = () => createAuth({ connectionString: 'postgres://u:p@127.0.0.1:1/none' });

  it('registers the sender as a key inside emailAndPassword when the config is present', () => {
    withEnv({ RESEND_API_KEY: 're_test_key', AUTH_EMAIL_FROM: 'Moyo <hello@moyolearn.com>' }, () => {
      const { emailAndPassword } = boot().options;
      assert.equal(typeof emailAndPassword?.sendResetPassword, 'function');
      assert.equal(emailAndPassword?.revokeSessionsOnPasswordReset, true);
    });
  });

  /*
    Absent config leaves the option off rather than installing a sender that
    cannot send. better-auth then answers /request-password-reset with
    BAD_REQUEST RESET_PASSWORD_DISABLED and logs the missing option by name
    (dist/api/routes/password.mjs:53-56) — a refusal that says why, which beats
    a sender that accepts the call and drops the mail.

    NODE_ENV is development here only to silence the unrelated verification
    console.error this same branch triggers; the sender gate reads the config,
    not the environment.
  */
  it('leaves it off when the config is absent, so better-auth refuses and says why', () => {
    withEnv(
      { RESEND_API_KEY: undefined, AUTH_EMAIL_FROM: undefined, NODE_ENV: 'development' },
      () => {
        assert.equal(boot().options.emailAndPassword?.sendResetPassword, undefined);
      },
    );
  });
});
