// The consumer plan catalogue: the two plans a parent may be shown, with the
// numbers moyolearn.com/pricing publishes (read 2026-11-25). Every parent-facing
// price string in the repo is derived from this file — the paywall, the org-free
// marketing site, the FAQ — so the number a parent reads and the number Stripe
// bills cannot drift apart by surface.
//
// Prices are integer cents, never strings: a string is copy, and copy forks.
// Business tiers (Solo/Studio/Scale) are deliberately absent. Doc 05 §2.2 keeps
// them off every surface a parent reads, and a catalogue that held both would
// need every consumer to filter — the omission is the filter.
//
// `trialDays` is NOT restated here. It lives on `PLANS` (billing-plans.ts) because
// the Stripe plugin reads it from there, and a second copy would be a second
// answer to "how long is the trial".
// SOT: https://www.moyolearn.com/pricing · docs/pack/05-monetization-access-spec.md §1.1 · §2.2
// SOT-KEYWORDS: plan catalogue consumer plus family price cents trial additional child parent pricing

import { PLANS, type PlanName } from './billing-plans.ts';

/** The plans a parent can buy. Narrowed from `PlanName`, never a parallel union. */
export type ConsumerPlanName = Extract<PlanName, 'plus' | 'family'>;

export interface ConsumerPlan {
  name: ConsumerPlanName;
  /** The product name as the pricing page prints it. */
  title: string;
  /** Who it is for, in the pricing page's words. */
  audience: string;
  monthlyCents: number;
  /** Learners covered by the monthly price. */
  includedChildren: number;
  /** Per-month charge for each child beyond `includedChildren`; absent when the plan cannot grow. */
  additionalChildMonthlyCents?: number;
  /** The one line the paywall card is for. */
  promise: string;
}

export const CONSUMER_PLANS = {
  plus: {
    name: 'plus',
    title: 'Moyo Plus',
    audience: 'Individual learner',
    monthlyCents: 14_99,
    includedChildren: 1,
    promise: 'The whole tutor, for one learner.',
  },
  family: {
    name: 'family',
    title: 'Moyo Family',
    audience: 'Families',
    monthlyCents: 24_99,
    includedChildren: 3,
    additionalChildMonthlyCents: 11_00,
    promise: 'The whole tutor, for every child in your family.',
  },
} as const satisfies Record<ConsumerPlanName, ConsumerPlan>;

/** Display order: the pricing page leads with the single learner. */
export const CONSUMER_PLAN_ORDER = ['plus', 'family'] as const satisfies readonly ConsumerPlanName[];

export const consumerPlans = (): readonly ConsumerPlan[] =>
  CONSUMER_PLAN_ORDER.map((name) => CONSUMER_PLANS[name]);

export const isConsumerPlan = (plan: PlanName): plan is ConsumerPlanName => plan in CONSUMER_PLANS;

/**
 * The trial length a parent is promised. Both consumer plans carry the same
 * `trialDays` on `PLANS`; this reads it rather than restating it, and the
 * catalogue test holds the two plans to one number so the sentence "30 days
 * free" can never be true of one card and false of the other.
 */
export const consumerTrialDays = (): number => PLANS.plus.trialDays;

/**
 * Whole dollars print without cents ("$11"); anything else prints two places
 * ("$14.99"). Integer arithmetic throughout: 1499 / 100 in floating point is
 * exactly the kind of thing that puts "$14.990000000000002" on a pricing page.
 */
export function formatUsd(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new RangeError(`A price is a non-negative integer number of cents, got ${String(cents)}.`);
  }
  const dollars = Math.floor(cents / 100);
  const rest = cents % 100;
  return rest === 0 ? `$${dollars}` : `$${dollars}.${String(rest).padStart(2, '0')}`;
}

/** `$14.99` */
export const monthlyPrice = (plan: ConsumerPlanName): string =>
  formatUsd(CONSUMER_PLANS[plan].monthlyCents);

/** `$14.99/mo` — the figure with its billing condition attached (doc 05 §1.1). */
export const monthlyPriceLine = (plan: ConsumerPlanName): string => `${monthlyPrice(plan)}/mo`;

/** `$14.99 a month` — the spoken form for prose. */
export const monthlyPriceSentence = (plan: ConsumerPlanName): string =>
  `${monthlyPrice(plan)} a month`;

/** `$11` for the family plan's extra child; null for a plan that cannot grow. */
export function additionalChildPrice(plan: ConsumerPlanName): string | null {
  // Widened to the interface: the literal type of `plus` has no rider key at all.
  const { additionalChildMonthlyCents: cents }: ConsumerPlan = CONSUMER_PLANS[plan];
  return cents === undefined ? null : formatUsd(cents);
}

/** `up to 3 children` / `one learner` — the coverage in words. */
export function coverageSentence(plan: ConsumerPlanName): string {
  const { includedChildren } = CONSUMER_PLANS[plan];
  return includedChildren === 1 ? 'one learner' : `up to ${includedChildren} children`;
}

/**
 * The per-child rider, as one sentence, or null when there is none. Returned
 * from here so the paywall, the pricing card and the FAQ cannot each phrase the
 * same fact differently.
 */
export function additionalChildSentence(plan: ConsumerPlanName): string | null {
  const price = additionalChildPrice(plan);
  if (price === null) return null;
  const { includedChildren } = CONSUMER_PLANS[plan];
  return `Each additional child after the first ${includedChildren} is ${price}/mo.`;
}
