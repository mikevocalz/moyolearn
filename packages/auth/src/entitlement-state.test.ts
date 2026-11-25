// The derived entitlement state, held to a table. Every raw status crosses every
// date condition that matters to it, and each cell names the state and whether
// paid capabilities are live. A cell this table does not have is a transition
// nobody has decided.
// SOT: docs/pack/06-auth-onboarding-spec.md §4 · docs/pack/05-monetization-access-spec.md §1.2 · §6
// SOT-KEYWORDS: entitlement state test table trial active past due cancel period end lapsed restored

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  can,
  entitlementStateOf,
  entitlementsFor,
  isEntitledState,
  resolveEntitlement,
  subscriptionFor,
  ENTITLED_STATES,
  ENTITLEMENT_STATES,
  NO_SUBSCRIPTION,
  type EntitlementState,
  type SubscriptionState,
  type SubscriptionStatus,
} from './entitlements.ts';

const NOW = new Date('2026-11-25T12:00:00Z');
const PAST = '2026-11-01T12:00:00.000Z';
const FUTURE = '2026-12-20T12:00:00.000Z';

const sub = (over: Partial<SubscriptionState>): SubscriptionState => ({
  ...NO_SUBSCRIPTION,
  plan: 'family',
  referenceId: 'user_1',
  ...over,
});

interface Row {
  label: string;
  input: Partial<SubscriptionState>;
  state: Exclude<EntitlementState, 'restored'>;
  entitled: boolean;
}

/** status × dates → state. Read it as the spec. */
const TABLE: Row[] = [
  { label: 'never subscribed', input: { status: 'none', plan: null, referenceId: null }, state: 'none', entitled: false },
  { label: 'first payment never landed', input: { status: 'incomplete' }, state: 'none', entitled: false },

  { label: 'trial, end unknown', input: { status: 'trialing' }, state: 'trial', entitled: true },
  { label: 'trial, ends later', input: { status: 'trialing', trialEnd: FUTURE, periodEnd: FUTURE }, state: 'trial', entitled: true },
  { label: 'trial ended, no payment', input: { status: 'trialing', trialEnd: PAST, periodEnd: PAST }, state: 'lapsed', entitled: false },
  { label: 'trial ended by trialEnd even if periodEnd is later', input: { status: 'trialing', trialEnd: PAST, periodEnd: FUTURE }, state: 'lapsed', entitled: false },

  { label: 'active, end unknown', input: { status: 'active' }, state: 'active', entitled: true },
  { label: 'active, renews later', input: { status: 'active', periodEnd: FUTURE }, state: 'active', entitled: true },
  { label: 'active row whose period already ended', input: { status: 'active', periodEnd: PAST }, state: 'lapsed', entitled: false },
  { label: 'cancelled, period still running', input: { status: 'active', cancelAtPeriodEnd: true, periodEnd: FUTURE }, state: 'cancel-at-period-end', entitled: true },
  { label: 'cancelled, end unknown', input: { status: 'active', cancelAtPeriodEnd: true }, state: 'cancel-at-period-end', entitled: true },
  { label: 'cancelled, period over', input: { status: 'active', cancelAtPeriodEnd: true, periodEnd: PAST }, state: 'lapsed', entitled: false },

  { label: 'card failed, retrying inside the period', input: { status: 'past_due', periodEnd: FUTURE }, state: 'past-due', entitled: true },
  { label: 'card failed, end unknown', input: { status: 'past_due' }, state: 'past-due', entitled: true },
  { label: 'card failed, period over (unpaid)', input: { status: 'past_due', periodEnd: PAST }, state: 'lapsed', entitled: false },

  { label: 'canceled with the paid period still running', input: { status: 'canceled', periodEnd: FUTURE }, state: 'cancel-at-period-end', entitled: true },
  { label: 'canceled, period over', input: { status: 'canceled', periodEnd: PAST }, state: 'lapsed', entitled: false },
  { label: 'canceled, no end on record', input: { status: 'canceled' }, state: 'lapsed', entitled: false },
];

describe('entitlement state — the table', () => {
  for (const row of TABLE) {
    it(`${row.label} → ${row.state}`, () => {
      const subscription = sub(row.input);
      const state = entitlementStateOf(subscription, NOW);
      assert.equal(state, row.state);
      assert.equal(isEntitledState(state), row.entitled);

      const entitlements = entitlementsFor(subscription, NOW);
      assert.equal(entitlements.state, row.state);
      assert.equal(entitlements.active, row.entitled);
      assert.equal(can(entitlements, 'write'), row.entitled);
      // Doc 05 §1.2 and §6: the floor and export never depend on the state.
      assert.equal(can(entitlements, 'practise'), true);
      assert.equal(can(entitlements, 'export'), true);
    });
  }

  it('covers every raw status', () => {
    const statuses: SubscriptionStatus[] = ['none', 'trialing', 'active', 'past_due', 'canceled', 'incomplete'];
    for (const status of statuses) {
      assert.ok(TABLE.some((row) => (row.input.status ?? 'none') === status), status);
    }
  });

  it('names every state at least once, except restored which needs two rows', () => {
    for (const state of ENTITLEMENT_STATES) {
      if (state === 'restored') continue;
      assert.ok(TABLE.some((row) => row.state === state), state);
    }
  });

  it('keeps ENTITLED_STATES a subset of ENTITLEMENT_STATES', () => {
    for (const state of ENTITLED_STATES) assert.ok(ENTITLEMENT_STATES.includes(state), state);
    assert.equal(isEntitledState('none'), false);
    assert.equal(isEntitledState('lapsed'), false);
  });

  it('only trial carries the trialing flag; only active and restored stop offering an upgrade', () => {
    for (const row of TABLE) {
      const e = entitlementsFor(sub(row.input), NOW);
      assert.equal(e.trialing, row.state === 'trial', row.label);
      assert.equal(e.shouldOfferUpgrade, row.state !== 'active', row.label);
    }
    assert.equal(entitlementsFor(sub({ status: 'active' }), NOW, 'restored').shouldOfferUpgrade, false);
  });

  it('zeroes plan limits once lapsed, keeps them while cancel-at-period-end', () => {
    const studio = (over: Partial<SubscriptionState>) =>
      entitlementsFor(sub({ plan: 'ops-studio', referenceId: 'org_1', ...over }), NOW);
    assert.equal(can(studio({ status: 'active', cancelAtPeriodEnd: true, periodEnd: FUTURE }), 'payout-automation'), true);
    assert.equal(can(studio({ status: 'active', cancelAtPeriodEnd: true, periodEnd: PAST }), 'payout-automation'), false);
  });
});

describe('entitlement state — transitions across rows', () => {
  const lapsedRow = sub({ status: 'canceled', periodEnd: PAST });
  const activeRow = sub({ status: 'active', periodEnd: FUTURE });
  const trialRow = sub({ status: 'trialing', trialEnd: FUTURE, periodEnd: FUTURE });

  it('restore: a lapsed reference with a new active row is restored and entitled', () => {
    const resolved = resolveEntitlement([lapsedRow, activeRow], 'user_1', NOW);
    assert.equal(resolved.state, 'restored');
    assert.equal(resolved.subscription, activeRow);
    assert.equal(resolved.entitlements.active, true);
    assert.equal(can(resolved.entitlements, 'write'), true);
    assert.equal(resolved.entitlements.shouldOfferUpgrade, false);
  });

  it('restore does not depend on row order', () => {
    assert.equal(resolveEntitlement([activeRow, lapsedRow], 'user_1', NOW).state, 'restored');
  });

  it('a new trial after a lapse is also a restore', () => {
    assert.equal(resolveEntitlement([lapsedRow, trialRow], 'user_1', NOW).state, 'restored');
  });

  it('a lapsed reference with no new row stays lapsed', () => {
    const resolved = resolveEntitlement([lapsedRow], 'user_1', NOW);
    assert.equal(resolved.state, 'lapsed');
    assert.equal(can(resolved.entitlements, 'write'), false);
    assert.equal(can(resolved.entitlements, 'practise'), true);
  });

  it('two dead rows: the later period end governs, and it is still lapsed', () => {
    const older = sub({ status: 'canceled', periodEnd: '2026-01-01T00:00:00.000Z' });
    const resolved = resolveEntitlement([older, lapsedRow], 'user_1', NOW);
    assert.equal(resolved.state, 'lapsed');
    assert.equal(resolved.subscription, lapsedRow);
  });

  it('cancel-at-period-end beside an old lapse is not a restore — the customer is leaving', () => {
    const leaving = sub({ status: 'active', cancelAtPeriodEnd: true, periodEnd: FUTURE });
    assert.equal(resolveEntitlement([lapsedRow, leaving], 'user_1', NOW).state, 'cancel-at-period-end');
  });

  it('subscriptionFor returns the governing row, never the dead one', () => {
    assert.equal(subscriptionFor([lapsedRow, activeRow], 'user_1', NOW), activeRow);
  });

  it('reads only the reference asked for', () => {
    const org = sub({ plan: 'ops-solo', referenceId: 'org_1', status: 'active', periodEnd: FUTURE });
    assert.equal(resolveEntitlement([lapsedRow, org], 'user_1', NOW).state, 'lapsed');
    assert.equal(resolveEntitlement([lapsedRow, org], 'org_1', NOW).state, 'active');
    assert.equal(resolveEntitlement([lapsedRow, org], 'org_2', NOW).state, 'none');
    assert.equal(resolveEntitlement([lapsedRow, org], null, NOW).state, 'none');
  });
});
