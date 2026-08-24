// S16's two cards, as data. Prices are display copy paired with the plan whose
// price id the server actually charges — the number a guardian reads and the
// number Stripe bills must come from one row, or the paywall lies by drift.
// SOT: docs/pack/05-monetization-access-spec.md §6 S16
// SOT-KEYWORDS: paywall s16 plans family early bird price annual monthly copy

import type { PlanName } from '@acme/auth';

export interface PaywallOffer {
  plan: PlanName;
  title: string;
  /** Monthly figure, always — the annual card states its own monthly equivalent
   *  so a guardian is never asked to divide (doc 05 §1.1's annual-as-monthly anchor). */
  monthly: string;
  /** What is actually charged, and how often. Never omitted on an annual plan. */
  billed: string;
  /** The one thing this card is FOR. One line, no feature list. */
  promise: string;
  /** Early-bird only: the real terms, plainly (doc 05 §6 S16 copy rule). */
  terms?: string;
}

/**
 * Two cards, not three. Doc 05 §6 says "plan compare = two cards"; a third
 * choice at the moment of commitment is a decision the guardian did not come to
 * make. The early-bird card is the anchor while it exists.
 */
export const PAYWALL_OFFERS: PaywallOffer[] = [
  {
    plan: 'family-early-bird',
    title: 'Founding family',
    monthly: '$11/month',
    billed: 'Billed monthly',
    promise: 'The whole tutor, for every child in your family.',
    // No countdown theater (doc 05 §6): the terms say what is true and stop.
    terms: 'Founding price, locked for as long as you stay subscribed.',
  },
  {
    plan: 'family',
    title: 'Family',
    monthly: '$15.99/month',
    billed: 'Billed monthly',
    promise: 'The whole tutor, for every child in your family.',
  },
];

/** Long-form, so a guardian reads a date rather than counting days. */
export const formatTrialDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
