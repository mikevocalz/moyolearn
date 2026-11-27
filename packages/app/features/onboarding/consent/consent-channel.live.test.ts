// The LIVE channel on native: a guardian signed in through the Expo client has
// their session in SecureStore, not in a cookie jar `fetch` can see, so every
// consent call has to carry it — or the proxy answers 401 before a code is sent.
// The API origin is set before the module loads because API_URL is read once,
// at import, exactly as on a device.
// SOT: packages/app/core/api-session.ts · docs/pack/06-auth-onboarding-spec.md §3.1
// SOT-KEYWORDS: consent channel live test native session cookie securestore 401

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

process.env.EXPO_PUBLIC_APP_URL = 'https://app.moyolearn.test';
const { createLiveConsentChannel } = await import('./consent-channel.ts');

interface Sent {
  url: string;
  headers: Record<string, string>;
  credentials: RequestCredentials | undefined;
}

function recorder(reply: Record<string, unknown>) {
  const sent: Sent[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    sent.push({
      url: String(input),
      headers: { ...(init?.headers as Record<string, string>) },
      credentials: init?.credentials,
    });
    return new Response(JSON.stringify(reply), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  return { sent, fetchImpl };
}

const nativeSession = { getCookie: async () => 'better-auth.session_token=signed-in' };

describe('the live consent channel', () => {
  it('sends the native session cookie with the challenge request', async () => {
    const { sent, fetchImpl } = recorder({ ok: true, challengeId: '7' });
    const channel = createLiveConsentChannel(nativeSession, fetchImpl);
    assert.deepEqual(await channel.send('email-plus', 'ada@example.com'), { challengeId: '7' });
    assert.equal(sent[0]?.url, 'https://app.moyolearn.test/api/family/consent/challenge');
    assert.equal(sent[0]?.headers.cookie, 'better-auth.session_token=signed-in');
  });

  it('carries it on verify, confirm and record too', async () => {
    const { sent, fetchImpl } = recorder({ matched: true, ok: true, consentId: '7' });
    const channel = createLiveConsentChannel(nativeSession, fetchImpl);
    await channel.verify('7', '123456');
    await channel.sendConfirmation('7');
    await channel.record('7', { scope: 'tutoring', policyVersion: '2026-08-01' });
    assert.equal(sent.length, 3);
    for (const request of sent) assert.equal(request.headers.cookie, 'better-auth.session_token=signed-in');
  });

  it('leaves web unchanged: no cookie header, the browser’s own credentials', async () => {
    const { sent, fetchImpl } = recorder({ ok: true, challengeId: '7' });
    await createLiveConsentChannel(null, fetchImpl).send('email-plus', 'ada@example.com');
    assert.equal(sent[0]?.headers.cookie, undefined);
    assert.equal(sent[0]?.credentials, 'include');
  });
});
