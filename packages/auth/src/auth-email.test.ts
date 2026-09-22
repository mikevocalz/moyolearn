// The sender's contract, asserted without a network. The expensive mistakes
// here are quiet ones: a half-configured sender that looks wired, a raw
// verification token handed to a third party, and a recipient address written
// into a log line.
// SOT: docs/pack/06-auth-onboarding-spec.md §6 · docs/incidents/2026-09-22-login-lockout.md
// SOT-KEYWORDS: auth email test resend verification idempotency escaping sender config

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import {
  escapeHtml,
  idempotencyKeyFor,
  readAuthEmailConfig,
  sendAuthEmail,
  verificationEmail,
  type AuthEmailConfig,
  type FetchLike,
} from './auth-email.ts';

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
  const token = 'eyJhbGciOiJIUzI1NiJ9.payload.signature';

  it('is stable for one token, so a retry is the same send', () => {
    assert.equal(idempotencyKeyFor(token), idempotencyKeyFor(token));
  });

  it('differs between tokens', () => {
    assert.notEqual(idempotencyKeyFor(token), idempotencyKeyFor(`${token}x`));
  });

  it('never carries the raw token — it is a credential, and the header is third-party', () => {
    const key = idempotencyKeyFor(token);
    assert.ok(!key.includes(token));
    assert.ok(!key.includes('signature'));
    assert.equal(key, `verify-${createHash('sha256').update(token).digest('hex')}`);
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
});
