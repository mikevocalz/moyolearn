// Doc 06 §4's reference rules and doc 05's two promises, asserted. The ones that
// would be expensive to get wrong: a member cannot spend their employer's money,
// a lapsed card cannot take a child's practice away, and export survives
// cancellation.
// SOT: docs/pack/06-auth-onboarding-spec.md §4 · docs/pack/05-monetization-access-spec.md §1.2 · §6
// SOT-KEYWORDS: billing test authorize reference entitlements grace export practise payout

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  authorizeReference,
  isBillingRole,
  plansFor,
  resolvePrices,
  PLANS,
  type PlanName,
} from './billing-plans.ts';
import {
  can,
  daysLeft,
  entitlementsFor,
  subscriptionFor,
  NO_SUBSCRIPTION,
  type SubscriptionState,
  type SubscriptionStatus,
} from './entitlements.ts';

const ALL_STATUSES: SubscriptionStatus[] = [
  'none',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete',
];

const sub = (over: Partial<SubscriptionState> = {}): SubscriptionState => ({
  ...NO_SUBSCRIPTION,
  ...over,
});

describe('who may buy what, for whom', () => {
  it('lets a guardian buy a family plan for themselves', () => {
    const result = authorizeReference({
      plan: 'family',
      referenceId: 'user_1',
      user: { id: 'user_1' },
    });
    assert.deepEqual(result, { ok: true });
  });

  it('refuses a family plan referenced at anyone else', () => {
    const result = authorizeReference({
      plan: 'family',
      referenceId: 'user_2',
      user: { id: 'user_1' },
    });
    assert.equal(result.ok, false);
  });

  it('lets an owner or finance member buy for the organisation', () => {
    for (const role of ['owner', 'finance']) {
      const result = authorizeReference({
        plan: 'ops-studio',
        referenceId: 'org_1',
        user: { id: 'user_1' },
        membershipRole: role,
      });
      assert.deepEqual(result, { ok: true }, role);
    }
  });

  it('refuses every other member, and refuses no membership at all', () => {
    for (const role of ['member', 'admin', 'tutor', undefined]) {
      const result = authorizeReference({
        plan: 'ops-studio',
        referenceId: 'org_1',
        user: { id: 'user_1' },
        membershipRole: role,
      });
      assert.equal(result.ok, false, String(role));
    }
    assert.equal(isBillingRole('admin'), false);
  });

  it('refuses an ops plan referenced at a person', () => {
    const result = authorizeReference({
      plan: 'ops-solo',
      referenceId: 'user_1',
      user: { id: 'user_1' },
    });
    assert.equal(result.ok, false);
  });
});

describe('the catalogue', () => {
  it('splits family from ops by who the customer is', () => {
    assert.deepEqual(
      plansFor('user').map((p) => p.name),
      ['family-early-bird', 'family'],
    );
    assert.equal(plansFor('organization').length, 3);
  });

  it('gates payout automation at Studio and above — that is what the tier is', () => {
    assert.equal(PLANS['ops-solo'].limits.payoutAutomation, 0);
    assert.equal(PLANS['ops-studio'].limits.payoutAutomation, 1);
    assert.equal(PLANS['ops-scale'].limits.payoutAutomation, 1);
  });

  it('gives every plan the same 30-day trial', () => {
    for (const plan of Object.values(PLANS)) assert.equal(plan.trialDays, 30);
  });

  it('reports unconfigured plans instead of failing to boot', () => {
    const { priced, missing } = resolvePrices({ STRIPE_PRICE_FAMILY: 'price_123' });
    assert.deepEqual(
      priced.map((p) => p.plan.name),
      ['family'],
    );
    assert.ok(missing.includes('ops-studio'));
  });

  it('never hardcodes a price id', () => {
    for (const plan of Object.values(PLANS)) {
      assert.doesNotMatch(plan.priceEnv, /^price_/, `${plan.name} carries a live price id`);
    }
  });
});

describe('the entitlements bridge', () => {
  it('keeps a child practising on every status there is', () => {
    for (const status of ALL_STATUSES) {
      assert.equal(
        entitlementsFor(sub({ status, plan: 'family' })).canPractise,
        true,
        `${status} took a child's practice away`,
      );
    }
  });

  it('keeps export available after cancellation — everything you set up stays', () => {
    for (const status of ALL_STATUSES) {
      assert.equal(entitlementsFor(sub({ status })).canExport, true, status);
    }
  });

  it('stops writes when nothing is paying, but not while a card is retrying', () => {
    assert.equal(entitlementsFor(sub({ status: 'past_due', plan: 'family' })).canWrite, true);
    assert.equal(entitlementsFor(sub({ status: 'canceled', plan: 'family' })).canWrite, false);
    assert.equal(entitlementsFor(sub({ status: 'incomplete', plan: 'family' })).canWrite, false);
    assert.equal(entitlementsFor(sub({ status: 'none' })).canWrite, false);
  });

  it('unlocks pay runs only on a paying Studio plan', () => {
    const studio = (status: SubscriptionStatus) =>
      can(entitlementsFor(sub({ status, plan: 'ops-studio' })), 'payout-automation');
    assert.equal(studio('active'), true);
    assert.equal(studio('trialing'), true);
    assert.equal(studio('canceled'), false);
    assert.equal(
      can(entitlementsFor(sub({ status: 'active', plan: 'ops-solo' })), 'payout-automation'),
      false,
    );
  });

  it('offers the upgrade everywhere except a paid, healthy subscription', () => {
    assert.equal(entitlementsFor(sub({ status: 'active', plan: 'family' })).shouldOfferUpgrade, false);
    for (const status of ALL_STATUSES.filter((s) => s !== 'active')) {
      assert.equal(entitlementsFor(sub({ status })).shouldOfferUpgrade, true, status);
    }
  });
});

describe('picking the right subscription', () => {
  const guardian = sub({ referenceId: 'user_1', status: 'canceled', plan: 'family' });
  const org = sub({ referenceId: 'org_1', status: 'active', plan: 'ops-studio' });

  it('reads the org’s subscription on an org surface, not the guardian’s', () => {
    assert.equal(subscriptionFor([guardian, org], 'org_1').status, 'active');
    assert.equal(subscriptionFor([guardian, org], 'user_1').status, 'canceled');
  });

  it('falls back to none rather than to someone else’s', () => {
    assert.deepEqual(subscriptionFor([guardian, org], 'org_2'), NO_SUBSCRIPTION);
    assert.deepEqual(subscriptionFor([guardian, org], null), NO_SUBSCRIPTION);
  });
});

describe('days left', () => {
  const now = new Date('2026-08-24T12:00:00Z');

  it('counts up to the period end and floors at zero', () => {
    assert.equal(daysLeft(sub({ periodEnd: '2026-09-01T12:00:00Z' }), now), 8);
    assert.equal(daysLeft(sub({ periodEnd: '2026-08-01T12:00:00Z' }), now), 0);
  });

  it('is null when there is no period to count', () => {
    assert.equal(daysLeft(sub(), now), null);
    assert.equal(daysLeft(sub({ periodEnd: 'not-a-date' }), now), null);
  });
});

describe('plan names', () => {
  it('keys the catalogue by its own name', () => {
    for (const [key, plan] of Object.entries(PLANS)) {
      assert.equal(plan.name, key as PlanName);
    }
  });
});
