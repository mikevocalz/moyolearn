// The entitlements bridge (doc 06 §4): subscription status → what the app lets
// you do. This is the projection `Stack.Protected` guards and `PermissionGate`
// read; nothing downstream ever looks at a Stripe status directly.
//
// Two rules from doc 05 that this file is the enforcement of:
//   §6 — read-only grace and export stay available AFTER expiry. "Everything
//        you've set up stays" is a promise, and a projection that dropped
//        `canExport` on cancellation would quietly break it.
//   §1.2 — a child's floor is never hostage. `canPractise` is true on every
//        status there is, including none at all.
// SOT: docs/pack/06-auth-onboarding-spec.md §4 · docs/pack/05-monetization-access-spec.md §1.2 · §6
// SOT-KEYWORDS: entitlements subscription status bridge gate grace export trial paywall

import { PLANS, type PlanLimits, type PlanName } from './billing-plans.ts';

/**
 * Stripe's subscription statuses, as the webhook delivers them. `none` is ours:
 * a family that never started a trial is a real state and the projection has to
 * name it rather than treat it as an error.
 */
export type SubscriptionStatus =
  | 'none'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete';

export interface SubscriptionState {
  plan: PlanName | null;
  status: SubscriptionStatus;
  /** Whose subscription: a guardian's user id or an organisation id. */
  referenceId: string | null;
  /** ISO. Drives the trial chip and the "your trial ends Friday" line. */
  periodEnd: string | null;
  /** Purchased seats from the plugin's own row (team plans); null when the row carries none. */
  seats: number | null;
}

export const NO_SUBSCRIPTION: SubscriptionState = {
  plan: null,
  status: 'none',
  referenceId: null,
  periodEnd: null,
  seats: null,
};

export interface Entitlements {
  /** Paid features are live. */
  active: boolean;
  /** Inside a trial — the same access, plus the countdown. */
  trialing: boolean;
  /**
   * Doc 05 §6: after expiry the account is readable and exportable forever. This
   * is the flag that keeps "everything you've set up stays" true.
   */
  canExport: boolean;
  /** Anything that writes. False the moment a subscription is not paying. */
  canWrite: boolean;
  /**
   * Doc 05 §1.2: the child's free practice floor. TRUE ON EVERY STATUS — a
   * lapsed card must never take a child's practice away, and a projection is
   * where that promise is either kept or quietly lost.
   */
  canPractise: boolean;
  /** Plan limits, zeroed when nothing is paying. */
  limits: PlanLimits;
  /** Show the paywall — never on a learner surface (CLAUDE.md), decided by the caller. */
  shouldOfferUpgrade: boolean;
}

const NO_LIMITS: PlanLimits = { payoutAutomation: 0 };

/**
 * `past_due` keeps writing. Stripe retries a failed card for days, and locking a
 * tutoring business out of its own calendar over a card that is about to succeed
 * costs more trust than the fortnight of service it protects. `canceled` and
 * `incomplete` do not: one is a decision and the other never started.
 */
export function entitlementsFor(subscription: SubscriptionState): Entitlements {
  const plan = subscription.plan ? PLANS[subscription.plan] : null;
  const limits = plan?.limits ?? NO_LIMITS;

  switch (subscription.status) {
    case 'trialing':
      return {
        active: true,
        trialing: true,
        canExport: true,
        canWrite: true,
        canPractise: true,
        limits,
        shouldOfferUpgrade: true,
      };
    case 'active':
      return {
        active: true,
        trialing: false,
        canExport: true,
        canWrite: true,
        canPractise: true,
        limits,
        shouldOfferUpgrade: false,
      };
    case 'past_due':
      return {
        active: true,
        trialing: false,
        canExport: true,
        canWrite: true,
        canPractise: true,
        limits,
        shouldOfferUpgrade: true,
      };
    case 'canceled':
    case 'incomplete':
    case 'none':
      return {
        active: false,
        trialing: false,
        // Read-only grace + export, always (doc 05 §6).
        canExport: true,
        canWrite: false,
        canPractise: true,
        limits: NO_LIMITS,
        shouldOfferUpgrade: true,
      };
  }
}

/** Days left in the current period, floored at zero. Feeds S17's rail chip. */
export function daysLeft(subscription: SubscriptionState, now: Date = new Date()): number | null {
  if (!subscription.periodEnd) return null;
  const end = new Date(subscription.periodEnd).getTime();
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.ceil((end - now.getTime()) / 86_400_000));
}

/**
 * A named capability, so features ask for what they need rather than reading
 * flags and reimplementing the policy in each screen.
 */
export type Capability = 'write' | 'export' | 'practise' | 'payout-automation';

export function can(entitlements: Entitlements, capability: Capability): boolean {
  switch (capability) {
    case 'write':
      return entitlements.canWrite;
    case 'export':
      return entitlements.canExport;
    case 'practise':
      return entitlements.canPractise;
    case 'payout-automation':
      return entitlements.limits.payoutAutomation > 0;
  }
}

/**
 * Which subscription applies to the surface being rendered. Ops surfaces bill to
 * the org, family surfaces to the guardian — reading the wrong one is how a
 * guardian's lapsed card locks an unrelated organisation out.
 */
export function subscriptionFor(
  subscriptions: SubscriptionState[],
  referenceId: string | null,
): SubscriptionState {
  if (!referenceId) return NO_SUBSCRIPTION;
  return subscriptions.find((s) => s.referenceId === referenceId) ?? NO_SUBSCRIPTION;
}
