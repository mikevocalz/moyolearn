// S16's two cards, derived from the consumer catalogue. The number a guardian
// reads here and the number Stripe bills come from one row in
// `@acme/auth/plan-catalog`; nothing in this file is a price.
// SOT: docs/pack/05-monetization-access-spec.md §6 S16 · https://www.moyolearn.com/pricing
// SOT-KEYWORDS: paywall s16 plans plus family price monthly copy catalogue derived

import {
  additionalChildSentence,
  consumerPlans,
  coverageSentence,
  monthlyPriceLine,
  type ConsumerPlanName,
} from '@acme/auth';

export interface PaywallOffer {
  plan: ConsumerPlanName;
  title: string;
  /** `$24.99/mo` — the figure with its billing condition attached. */
  monthly: string;
  /** Who the plan covers, in words: "one learner", "up to 3 children". */
  covers: string;
  /** The one thing this card is FOR. One line, no feature list. */
  promise: string;
  /** The per-child rider, when the plan has one. Stated on the card, not discovered on the invoice. */
  terms?: string;
}

/**
 * Two cards, not three. Doc 05 §6 says "plan compare = two cards"; a third
 * choice at the moment of commitment is a decision the guardian did not come to
 * make. Order and content follow the catalogue, so this list cannot disagree
 * with the pricing page.
 */
export const PAYWALL_OFFERS: readonly PaywallOffer[] = consumerPlans().map((plan) => {
  const terms = additionalChildSentence(plan.name);
  return {
    plan: plan.name,
    title: plan.title,
    monthly: monthlyPriceLine(plan.name),
    covers: coverageSentence(plan.name),
    promise: plan.promise,
    ...(terms ? { terms } : {}),
  };
});

/** Long-form, so a guardian reads a date rather than counting days. */
export const formatTrialDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
