// The consumer catalogue against the page of record (moyolearn.com/pricing,
// 2026-11-25), and the derivations every parent-facing string is built from.
// SOT: https://www.moyolearn.com/pricing · docs/pack/05-monetization-access-spec.md §2.2
// SOT-KEYWORDS: plan catalogue test consumer plus family price cents format trial business absent

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PLANS, isBusinessPlan, plansFor } from './billing-plans.ts';
import {
  additionalChildPrice,
  additionalChildSentence,
  consumerPlans,
  consumerTrialDays,
  coverageSentence,
  formatUsd,
  isConsumerPlan,
  monthlyPrice,
  monthlyPriceLine,
  monthlyPriceSentence,
  CONSUMER_PLAN_ORDER,
  CONSUMER_PLANS,
} from './plan-catalog.ts';

describe('the consumer catalogue', () => {
  it('is the pricing page: Plus $14.99, Family $24.99 for 3, $11 per extra child, 30 days free', () => {
    assert.equal(monthlyPrice('plus'), '$14.99');
    assert.equal(monthlyPrice('family'), '$24.99');
    assert.equal(CONSUMER_PLANS.plus.includedChildren, 1);
    assert.equal(CONSUMER_PLANS.family.includedChildren, 3);
    assert.equal(additionalChildPrice('family'), '$11');
    assert.equal(additionalChildPrice('plus'), null);
    assert.equal(consumerTrialDays(), 30);
  });

  it('shows a parent exactly two plans, in page order, and no business tier', () => {
    assert.deepEqual(
      consumerPlans().map((plan) => plan.name),
      ['plus', 'family'],
    );
    assert.deepEqual([...CONSUMER_PLAN_ORDER], ['plus', 'family']);
    for (const plan of consumerPlans()) {
      assert.equal(PLANS[plan.name].customerType, 'user', plan.name);
      assert.equal(isBusinessPlan(plan.name), false, plan.name);
    }
    for (const plan of plansFor('organization')) {
      assert.equal(isConsumerPlan(plan.name), false, plan.name);
    }
  });

  it('gives both consumer plans the same trial, so "30 days free" is true of every card', () => {
    const days = new Set(consumerPlans().map((plan) => PLANS[plan.name].trialDays));
    assert.equal(days.size, 1);
    assert.equal([...days][0], consumerTrialDays());
  });

  it('derives every display string from the cents', () => {
    assert.equal(monthlyPriceLine('plus'), '$14.99/mo');
    assert.equal(monthlyPriceSentence('family'), '$24.99 a month');
    assert.equal(coverageSentence('plus'), 'one learner');
    assert.equal(coverageSentence('family'), 'up to 3 children');
    assert.equal(additionalChildSentence('family'), 'Each additional child after the first 3 is $11/mo.');
    assert.equal(additionalChildSentence('plus'), null);
  });

  it('formats whole dollars without cents and never leaks floating point', () => {
    assert.equal(formatUsd(1100), '$11');
    assert.equal(formatUsd(1499), '$14.99');
    assert.equal(formatUsd(2499), '$24.99');
    assert.equal(formatUsd(5), '$0.05');
    assert.equal(formatUsd(0), '$0');
    assert.throws(() => formatUsd(14.99), RangeError);
    assert.throws(() => formatUsd(-1), RangeError);
  });
});
