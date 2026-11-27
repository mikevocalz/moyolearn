// The dev channel is a real implementation, so it gets real tests — these are
// exactly the three bugs a `return true` stub hides, and the three the live
// channel's server (consent-verification.test.ts) is held to as well.
// SOT: docs/pack/06-auth-onboarding-spec.md §3.1
// SOT-KEYWORDS: consent channel test code verify one-use wrong target dev

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createDevConsentChannel, CODE_LENGTH } from './consent-channel.ts';

describe('the dev consent channel', () => {
  it('issues a code of the stated length, all digits', async () => {
    const channel = createDevConsentChannel();
    await channel.send('email-plus', 'ada@example.com');
    const code = channel.peek('ada@example.com');
    assert.ok(code);
    assert.equal(code.length, CODE_LENGTH);
    assert.match(code, /^\d+$/);
  });

  it('refuses a code that is merely plausible', async () => {
    const channel = createDevConsentChannel();
    const { challengeId } = await channel.send('email-plus', 'ada@example.com');
    const real = channel.peek('ada@example.com');
    assert.ok(real);
    const wrong = real === '000000' ? '111111' : '000000';
    assert.equal(await channel.verify(challengeId, wrong), false);
    assert.equal(await channel.verify(challengeId, real), true);
  });

  it('will not verify one challenge with another challenge’s code', async () => {
    const channel = createDevConsentChannel();
    await channel.send('email-plus', 'ada@example.com');
    const grace = await channel.send('email-plus', 'grace@example.com');
    const adas = channel.peek('ada@example.com');
    assert.ok(adas);
    assert.equal(await channel.verify(grace.challengeId, adas), false);
  });

  it('spends the code — a second guardian on the same device starts over', async () => {
    const channel = createDevConsentChannel();
    const { challengeId } = await channel.send('email-plus', 'ada@example.com');
    const code = channel.peek('ada@example.com');
    assert.ok(code);
    assert.equal(await channel.verify(challengeId, code), true);
    assert.equal(await channel.verify(challengeId, code), false);
    assert.equal(channel.peek('ada@example.com'), undefined);
  });

  it('refuses everything for a challenge nothing was sent for', async () => {
    const channel = createDevConsentChannel();
    assert.equal(await channel.verify('dev-challenge-99', '123456'), false);
  });

  it('answers a record with an id the children step can send', async () => {
    const channel = createDevConsentChannel();
    const { challengeId } = await channel.send('email-plus', 'ada@example.com');
    const { consentId } = await channel.record(challengeId, { scope: 'tutoring', policyVersion: '2026-08-01' });
    assert.equal(consentId, `dev-consent-${challengeId}`);
  });
});
