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
//
// Between the raw Stripe status and the capability flags sits ONE derived
// `EntitlementState`. The raw status alone cannot answer "is this person still
// entitled": a `canceled` row with a period end next month is a paid customer
// who has given notice, and an `active` row is lapsed the day its card stops.
// `cancelAtPeriodEnd`, `periodEnd` and `trialEnd` are read here, once, and every
// surface asks the state rather than re-deriving it.
// SOT: docs/pack/06-auth-onboarding-spec.md §4 · docs/pack/05-monetization-access-spec.md §1.2 · §6
// SOT-KEYWORDS: entitlements subscription status bridge gate grace export trial paywall lapsed restored cancel period end

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
  /** ISO. The end of the paid (or trial) period; access runs to here. */
  periodEnd: string | null;
  /** ISO. When the trial ends, when the row carries one. Drives the countdown. */
  trialEnd: string | null;
  /** The guardian pressed cancel; Stripe stops billing at `periodEnd`. */
  cancelAtPeriodEnd: boolean;
  /** Purchased seats from the plugin's own row (team plans); null when the row carries none. */
  seats: number | null;
}

export const NO_SUBSCRIPTION: SubscriptionState = {
  plan: null,
  status: 'none',
  referenceId: null,
  periodEnd: null,
  trialEnd: null,
  cancelAtPeriodEnd: false,
  seats: null,
};

/**
 * What a subscription IS right now, decided from status and dates together.
 *
 *   none                 Never subscribed, or the first payment never landed.
 *   trial                Inside the free trial.
 *   active               Paying, nothing pending.
 *   past-due             A charge failed; Stripe is retrying. Still entitled.
 *   cancel-at-period-end Cancelled, but the paid period has not ended. Still entitled.
 *   lapsed               Not entitled: ended, unpaid past the period, or a trial that ran out.
 *   restored             Entitled again after a lapse — a new paying row beside an old dead one.
 */
export const ENTITLEMENT_STATES = [
  'none',
  'trial',
  'active',
  'past-due',
  'cancel-at-period-end',
  'lapsed',
  'restored',
] as const;
export type EntitlementState = (typeof ENTITLEMENT_STATES)[number];

/** States in which paid capabilities are live. Derived from the list, not retyped. */
export const ENTITLED_STATES = [
  'trial',
  'active',
  'past-due',
  'cancel-at-period-end',
  'restored',
] as const satisfies readonly EntitlementState[];

export const isEntitledState = (state: EntitlementState): boolean =>
  (ENTITLED_STATES as readonly EntitlementState[]).includes(state);

const instant = (iso: string | null): number | null => {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? null : ms;
};

/** True when the row names an end and it is already behind us. An unknown end is not "ended". */
const ended = (iso: string | null, now: Date): boolean => {
  const end = instant(iso);
  return end !== null && end <= now.getTime();
};

/**
 * One row → one state. `restored` is never produced here: it is a relation
 * between two rows and belongs to `resolveEntitlement`.
 *
 * `past_due` keeps writing. Stripe retries a failed card for days, and locking a
 * tutoring business out of its own calendar over a card that is about to succeed
 * costs more trust than the fortnight of service it protects. It stops being
 * benefit-of-the-doubt once the period it was meant to pay for is over.
 */
export function entitlementStateOf(
  subscription: SubscriptionState,
  now: Date = new Date(),
): Exclude<EntitlementState, 'restored'> {
  switch (subscription.status) {
    case 'none':
    case 'incomplete':
      return 'none';
    case 'trialing':
      // A trial that has run out with no payment behind it is lapsed, whatever
      // the row still says. The trial end wins over the period end when both
      // are present because it is the date the parent was told.
      return ended(subscription.trialEnd ?? subscription.periodEnd, now) ? 'lapsed' : 'trial';
    case 'active':
      if (subscription.cancelAtPeriodEnd) {
        return ended(subscription.periodEnd, now) ? 'lapsed' : 'cancel-at-period-end';
      }
      return ended(subscription.periodEnd, now) ? 'lapsed' : 'active';
    case 'past_due':
      return ended(subscription.periodEnd, now) ? 'lapsed' : 'past-due';
    case 'canceled':
      // Stripe writes `canceled` at the moment the period ends, but a webhook
      // that arrives early, or a row cancelled by hand, can carry a future
      // `periodEnd`. The paid period is honoured either way. No end date means
      // nothing left to honour.
      return subscription.periodEnd !== null && !ended(subscription.periodEnd, now)
        ? 'cancel-at-period-end'
        : 'lapsed';
  }
}

export interface Entitlements {
  /** The derived state every flag below follows from. */
  state: EntitlementState;
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
  /** Show the paywall — never on a learner surface (CONTRIBUTING.md), decided by the caller. */
  shouldOfferUpgrade: boolean;
}

const NO_LIMITS: PlanLimits = { payoutAutomation: 0 };

/**
 * State → flags. The `state` argument lets `resolveEntitlement` pass `restored`
 * in; a lone row derives its own.
 */
export function entitlementsFor(
  subscription: SubscriptionState,
  now: Date = new Date(),
  state: EntitlementState = entitlementStateOf(subscription, now),
): Entitlements {
  const plan = subscription.plan ? PLANS[subscription.plan] : null;
  const limits = plan?.limits ?? NO_LIMITS;

  switch (state) {
    case 'trial':
      return {
        state,
        active: true,
        trialing: true,
        canExport: true,
        canWrite: true,
        canPractise: true,
        limits,
        shouldOfferUpgrade: true,
      };
    case 'active':
    case 'restored':
      return {
        state,
        active: true,
        trialing: false,
        canExport: true,
        canWrite: true,
        canPractise: true,
        limits,
        shouldOfferUpgrade: false,
      };
    case 'past-due':
    case 'cancel-at-period-end':
      // Entitled to the end of the period already paid for, and the one moment a
      // resume or a fixed card is worth asking for.
      return {
        state,
        active: true,
        trialing: false,
        canExport: true,
        canWrite: true,
        canPractise: true,
        limits,
        shouldOfferUpgrade: true,
      };
    case 'lapsed':
    case 'none':
      return {
        state,
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
  const end = instant(subscription.periodEnd);
  if (end === null) return null;
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

export interface ResolvedEntitlement {
  /** The row that governs, or `NO_SUBSCRIPTION`. */
  subscription: SubscriptionState;
  state: EntitlementState;
  entitlements: Entitlements;
}

type Ranked = { subscription: SubscriptionState; state: Exclude<EntitlementState, 'restored'> };

function outranks(a: Ranked, b: Ranked): boolean {
  const entitledA = isEntitledState(a.state);
  const entitledB = isEntitledState(b.state);
  if (entitledA !== entitledB) return entitledA;
  return (
    (instant(a.subscription.periodEnd) ?? Number.NEGATIVE_INFINITY) >
    (instant(b.subscription.periodEnd) ?? Number.NEGATIVE_INFINITY)
  );
}

const nothing = (now: Date): ResolvedEntitlement => ({
  subscription: NO_SUBSCRIPTION,
  state: 'none',
  entitlements: entitlementsFor(NO_SUBSCRIPTION, now, 'none'),
});

/**
 * Which subscription applies to the surface being rendered, and what it means.
 * Ops surfaces bill to the org, family surfaces to the guardian — reading the
 * wrong one is how a guardian's lapsed card locks an unrelated organisation out.
 *
 * A reference can hold MORE THAN ONE row: a family that cancelled last spring and
 * subscribed again this autumn has a `canceled` row and an `active` one under
 * the same id. The entitled row governs; when it sits beside a dead one the
 * state is `restored`, so a surface can say "welcome back" rather than "you
 * cancelled". Among rows that tie, the later period end wins, so the newest
 * fact about the account is the one that counts.
 */
export function resolveEntitlement(
  subscriptions: readonly SubscriptionState[],
  referenceId: string | null,
  now: Date = new Date(),
): ResolvedEntitlement {
  if (!referenceId) return nothing(now);
  const rows: Ranked[] = subscriptions
    .filter((s) => s.referenceId === referenceId)
    .map((subscription) => ({ subscription, state: entitlementStateOf(subscription, now) }));
  if (rows.length === 0) return nothing(now);

  const current = rows.reduce((best, row) => (outranks(row, best) ? row : best));
  const hadLapse = rows.some((row) => row !== current && row.state === 'lapsed');
  const state: EntitlementState =
    hadLapse && (current.state === 'active' || current.state === 'trial') ? 'restored' : current.state;

  return {
    subscription: current.subscription,
    state,
    entitlements: entitlementsFor(current.subscription, now, state),
  };
}

/** The governing row alone, for callers that only need the subscription. */
export function subscriptionFor(
  subscriptions: readonly SubscriptionState[],
  referenceId: string | null,
  now: Date = new Date(),
): SubscriptionState {
  return resolveEntitlement(subscriptions, referenceId, now).subscription;
}
