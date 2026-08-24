// The dev channel is a real implementation, so it gets real tests — these are
// exactly the three bugs a `return true` stub hides, and the three a server-backed
// channel must also pass.
// SOT: docs/pack/06-auth-onboarding-spec.md §3.1
// SOT-KEYWORDS: consent channel test code verify one-use wrong target dev

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createDevConsentChannel, CODE_LENGTH } from './consent-channel.ts';

describe('the dev consent channel', () => {
  it('issues a code of the stated length, all digits', () => {
    const channel = createDevConsentChannel();
    void channel.send('email-plus', 'ada@example.com');
    const code = channel.peek('ada@example.com');
    assert.ok(code);
    assert.equal(code.length, CODE_LENGTH);
    assert.match(code, /^\d+$/);
  });

  it('refuses a code that is merely plausible', async () => {
    const channel = createDevConsentChannel();
    await channel.send('email-plus', 'ada@example.com');
    const real = channel.peek('ada@example.com');
    assert.ok(real);
    const wrong = real === '000000' ? '111111' : '000000';
    assert.equal(await channel.verify('ada@example.com', wrong), false);
    assert.equal(await channel.verify('ada@example.com', real), true);
  });

  it('will not verify one address with another address’s code', async () => {
    const channel = createDevConsentChannel();
    await channel.send('email-plus', 'ada@example.com');
    await channel.send('email-plus', 'grace@example.com');
    const adas = channel.peek('ada@example.com');
    assert.ok(adas);
    assert.equal(await channel.verify('grace@example.com', adas), false);
  });

  it('spends the code — a second guardian on the same device starts over', async () => {
    const channel = createDevConsentChannel();
    await channel.send('email-plus', 'ada@example.com');
    const code = channel.peek('ada@example.com');
    assert.ok(code);
    assert.equal(await channel.verify('ada@example.com', code), true);
    assert.equal(await channel.verify('ada@example.com', code), false);
  });

  it('refuses everything for an address nothing was sent to', async () => {
    const channel = createDevConsentChannel();
    assert.equal(await channel.verify('nobody@example.com', '123456'), false);
  });
});
