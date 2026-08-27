// S24's own gates, which moved out of the milestone test when the engine moved
// to features/trial. What they hold: only the org step blocks, and a step that
// offers a skip can actually honour it.
// SOT: docs/pack/06-auth-onboarding-spec.md §5
// SOT-KEYWORDS: onboarding business s24 test gates skip invitees org

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canAdvance,
  parseInvitees,
  BUSINESS_STEPS,
  EMPTY_BUSINESS_DRAFT,
  SKIP_LABEL,
  type BusinessDraft,
} from './steps.ts';

const draft = (over: Partial<BusinessDraft> = {}): BusinessDraft => ({
  ...EMPTY_BUSINESS_DRAFT,
  ...over,
});

describe('S24 gates', () => {
  it('gates only the org step', () => {
    for (const step of BUSINESS_STEPS) {
      if (step === 'org') continue;
      assert.equal(canAdvance(step, draft()), true, `${step} blocks a business it shouldn't`);
    }
    assert.equal(canAdvance('org', draft()), false);
    assert.equal(canAdvance('org', draft({ orgName: 'Bright Minds' })), false);
    assert.equal(
      canAdvance('org', draft({ orgName: 'Bright Minds', services: ['1:1 tutoring'] })),
      true,
    );
  });

  it('offers a skip only where advancing is genuinely allowed', () => {
    for (const step of BUSINESS_STEPS) {
      if (!SKIP_LABEL[step]) continue;
      assert.equal(canAdvance(step, draft()), true, `${step} offers a skip it cannot honour`);
    }
  });

  it('runs Stripe Connect before tutor invites — doc 37 §2 order', () => {
    assert.deepEqual(BUSINESS_STEPS, ['org', 'import', 'payments', 'invite', 'checklist']);
  });
});

describe('invitee parsing', () => {
  it('takes a pasted block in whatever shape it arrives', () => {
    assert.deepEqual(parseInvitees('a@x.com, b@x.com\nc@x.com; d@x.com'), [
      'a@x.com',
      'b@x.com',
      'c@x.com',
      'd@x.com',
    ]);
  });

  it('drops junk and duplicates instead of inviting them', () => {
    assert.deepEqual(parseInvitees('A@x.com a@x.com nonsense'), ['a@x.com']);
  });
});
