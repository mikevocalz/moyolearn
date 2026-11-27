// The native session cookie reaches the Moyo API and nowhere else.
// SOT: packages/app/core/api-session.ts
// SOT-KEYWORDS: api session cookie test native origin header

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sessionHeaders, type SessionCookieSource } from './api-session.ts';

const API = 'https://app.moyolearn.com';
const stored: SessionCookieSource = { getCookie: async () => 'better-auth.session_token=abc' };

describe('sessionHeaders', () => {
  it('attaches the stored cookie to a request on the configured API origin', async () => {
    assert.deepEqual(await sessionHeaders(`${API}/api/family/consent/challenge`, stored, API), {
      cookie: 'better-auth.session_token=abc',
    });
  });

  it('never sends the cookie to another origin', async () => {
    assert.deepEqual(await sessionHeaders('https://evil.example/api/family/consent/challenge', stored, API), {});
    assert.deepEqual(await sessionHeaders('http://app.moyolearn.com/api/x', stored, API), {});
  });

  it('adds nothing on web, where there is no source and the browser sends the cookie', async () => {
    assert.deepEqual(await sessionHeaders(`${API}/api/x`, null, API), {});
  });

  it('adds nothing when the base is not absolute (same-origin web or an unconfigured build)', async () => {
    assert.deepEqual(await sessionHeaders('/api/x', stored, ''), {});
  });

  it('adds nothing when the store is empty or cannot be read', async () => {
    assert.deepEqual(await sessionHeaders(`${API}/api/x`, { getCookie: async () => '' }, API), {});
    const broken: SessionCookieSource = {
      getCookie: async () => {
        throw new Error('keychain locked');
      },
    };
    assert.deepEqual(await sessionHeaders(`${API}/api/x`, broken, API), {});
  });
});
