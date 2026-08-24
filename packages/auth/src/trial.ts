// Trial dates and the cancellation contract — doc 05 §1.2's ARL standard, and
// the disclosure S16 has to show before anyone starts a trial.
//
// These are dates and rules, not copy, and they live here because they are the
// same facts a regulator would ask for: when access starts, when we warn, when
// money moves, and what a cancellation actually does. A screen that computed
// them itself would be a second answer to a question with one legal answer.
// SOT: docs/pack/05-monetization-access-spec.md §1.2 · §6 · docs/pack/06-auth-onboarding-spec.md §4
// SOT-KEYWORDS: trial schedule reminder renewal cancel arl refund grace disclosure

import { PLANS, type PlanName } from './billing-plans.ts';
import type { SubscriptionState } from './entitlements.ts';

/** Days before the trial ends that the reminder email goes out. */
export const TRIAL_REMINDER_DAYS_BEFORE = 3;

export interface TrialSchedule {
  /** Full access starts now — a trial that begins later is not a trial. */
  accessFrom: string;
  /** The reminder doc 05 §6 promises on the paywall. Promised, so it is scheduled. */
  reminderAt: string;
  /** Last free day. The one highlighter moment on S16. */
  endsAt: string;
  /** The first time money moves. Same instant as `endsAt`, named separately
   *  because "when does my trial end" and "when am I charged" are two questions
   *  and answering only the first is how surprise charges happen. */
  firstChargeAt: string;
  days: number;
}

const addDays = (from: Date, days: number) =>
  new Date(from.getTime() + days * 86_400_000).toISOString();

export function trialSchedule(plan: PlanName, startedAt: Date = new Date()): TrialSchedule {
  const days = PLANS[plan].trialDays;
  const endsAt = addDays(startedAt, days);
  return {
    accessFrom: startedAt.toISOString(),
    // A reminder scheduled after the charge is not a reminder. On a trial too
    // short to give the notice period, it goes out at the halfway mark instead.
    reminderAt: addDays(startedAt, Math.max(1, days - TRIAL_REMINDER_DAYS_BEFORE)),
    endsAt,
    firstChargeAt: endsAt,
    days,
  };
}

/**
 * What cancelling does, decided rather than described. Doc 05 §1.2's ARL
 * standard has three parts and this is all three: it is available in the app
 * (not only by phone or email), it takes effect without anyone approving it, and
 * it says plainly what the user keeps.
 */
export interface CancellationOutcome {
  /** Access runs to the end of the paid period — cancelling is not forfeiting. */
  accessUntil: string | null;
  /** True while the trial has not been charged: nothing was paid, nothing is owed. */
  duringTrial: boolean;
  /** Read-only + export survive cancellation forever (doc 05 §6). */
  keepsExport: true;
  /** No retention gauntlet, no "are you sure" chain — see CANCEL_STEPS. */
  requiresContactingSupport: false;
}

export function cancellationOutcome(subscription: SubscriptionState): CancellationOutcome {
  return {
    accessUntil: subscription.periodEnd,
    duringTrial: subscription.status === 'trialing',
    keepsExport: true,
    requiresContactingSupport: false,
  };
}

/**
 * The whole cancellation flow. Doc 05 §6's metric is completion in under 30
 * seconds, which is not a copy problem — it is a step-count problem, so the
 * steps are data and a test holds the ceiling.
 *
 * Two: press cancel, confirm. A third step is where retention offers live, and
 * doc 05 §1.2 bans that gauntlet outright.
 */
export const CANCEL_STEPS = ['confirm', 'done'] as const;
export type CancelStep = (typeof CANCEL_STEPS)[number];
export const MAX_CANCEL_STEPS = 2;

/**
 * Copy that has to be true rather than reassuring. Returned from here so the
 * screen cannot soften it: "you keep access until X" is a promise the dates
 * above are the evidence for.
 */
export function cancellationSummary(
  outcome: CancellationOutcome,
  formatDate: (iso: string) => string,
): string {
  if (outcome.duringTrial && outcome.accessUntil) {
    return `Your trial runs to ${formatDate(outcome.accessUntil)} and you won't be charged.`;
  }
  if (outcome.accessUntil) {
    return `You keep everything until ${formatDate(outcome.accessUntil)}, the end of the period you've paid for.`;
  }
  return 'Nothing further will be charged.';
}
