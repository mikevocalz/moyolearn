// The milestone engine and S24's gates. The point of the engine is that
// completion is DERIVED — doc 05 §2.3 charts trial→paid by milestone count, and
// a milestone that could be marked done without the thing happening would make
// that chart a lie.
// SOT: docs/pack/06-auth-onboarding-spec.md §5 · docs/pack/05-monetization-access-spec.md §2.3
// SOT-KEYWORDS: onboarding business s24 milestone test activation trial chip gates

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  milestoneProgress,
  trialChip,
  EMPTY_ACTIVATION,
  MILESTONES,
  type ActivationState,
} from './milestones.ts';
import {
  canAdvance,
  parseInvitees,
  BUSINESS_STEPS,
  EMPTY_BUSINESS_DRAFT,
  SKIP_LABEL,
  type BusinessDraft,
} from './steps.ts';

const state = (over: Partial<ActivationState> = {}): ActivationState => ({
  ...EMPTY_ACTIVATION,
  ...over,
});
const draft = (over: Partial<BusinessDraft> = {}): BusinessDraft => ({
  ...EMPTY_BUSINESS_DRAFT,
  ...over,
});

describe('milestone engine', () => {
  it('starts at zero and nudges the first unfinished one', () => {
    const p = milestoneProgress(EMPTY_ACTIVATION);
    assert.equal(p.done, 0);
    assert.equal(p.next?.id, 'import');
  });

  it('nudges in dependency order — never an invoice before a booking', () => {
    const p = milestoneProgress(state({ learnersImported: 12, tutorsInvited: 3 }));
    assert.equal(p.next?.id, 'payments');
  });

  it('reports finished when the account has really done everything', () => {
    const everything = state({
      learnersImported: 12,
      tutorsInvited: 3,
      merchantOnboarded: true,
      bookings: 1,
      invoices: 1,
    });
    const p = milestoneProgress(everything);
    assert.equal(p.done, MILESTONES.length);
    assert.equal(p.next, null);
  });

  it('cannot be completed except by state — no dismiss flag exists to set', () => {
    for (const milestone of MILESTONES) {
      assert.equal(milestone.done(EMPTY_ACTIVATION), false, `${milestone.id} starts done`);
    }
  });
});

describe('trial chip', () => {
  it('counts days and progress together', () => {
    assert.equal(trialChip(30, EMPTY_ACTIVATION), '30 days left · 0/5 set up');
    assert.equal(trialChip(1, EMPTY_ACTIVATION), '1 day left · 0/5 set up');
  });

  it('after expiry says what stays, not what was lost', () => {
    const copy = trialChip(0, state({ learnersImported: 4 }));
    assert.match(copy, /everything you built stays/);
    assert.doesNotMatch(copy, /expired|lost|deleted/i);
  });
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
