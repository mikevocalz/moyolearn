// The Stripe row → SubscriptionState projection, held against the entitlement
// state it produces. The projection is where Stripe's eight statuses collapse to
// doc 06's six, and a collapse that drags a field along can hand paid access to
// a row that never paid — so each collapsed status is checked end to end.
// SOT: docs/pack/06-auth-onboarding-spec.md §4 · docs/pack/05-monetization-access-spec.md §6
// SOT-KEYWORDS: subscription reader projection test paused unpaid canceled period end lapsed

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { entitlementStateOf, entitlementsFor } from './entitlements.ts';
import { toSubscriptionState, type SubscriptionRow } from './subscription-reader.ts';

const NOW = new Date('2026-11-25T12:00:00Z');
const FUTURE = new Date('2026-12-20T12:00:00.000Z');

const row = (over: Partial<SubscriptionRow>): SubscriptionRow => ({
  plan: 'family',
  status: 'active',
  referenceId: 'user_1',
  periodEnd: FUTURE,
  trialEnd: undefined,
  cancelAtPeriodEnd: false,
  seats: undefined,
  ...over,
});

describe('toSubscriptionState', () => {
  for (const status of ['paused', 'unpaid'] as const) {
    it(`${status} with a future period end is lapsed, not a paid notice period`, () => {
      const state = toSubscriptionState(row({ status }));
      assert.equal(state.status, 'canceled');
      assert.equal(state.periodEnd, null);
      assert.equal(entitlementStateOf(state, NOW), 'lapsed');
      const flags = entitlementsFor(state, NOW);
      assert.equal(flags.active, false);
      assert.equal(flags.canWrite, false);
      // Doc 05 §6 and §1.2 survive the lapse.
      assert.equal(flags.canExport, true);
      assert.equal(flags.canPractise, true);
    });
  }

  it('a genuinely canceled row keeps its paid period', () => {
    const state = toSubscriptionState(row({ status: 'canceled' }));
    assert.equal(state.periodEnd, FUTURE.toISOString());
    assert.equal(entitlementStateOf(state, NOW), 'cancel-at-period-end');
  });

  it('past_due keeps its period end so the retry window stays entitled', () => {
    const state = toSubscriptionState(row({ status: 'past_due' }));
    assert.equal(state.periodEnd, FUTURE.toISOString());
    assert.equal(entitlementStateOf(state, NOW), 'past-due');
  });
});
