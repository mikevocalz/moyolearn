// S17's numbers and its sentence. Doc 05 §6: "sell the subscription with the
// business's own trial data" — the pitch is their fortnight, not our feature
// list, and §2.3 charts trial→paid BY MILESTONE COUNT for the same reason.
// SOT: docs/pack/05-monetization-access-spec.md §6 S17 · §2.3
// SOT-KEYWORDS: trial convert s17 stats milestones days left copy tier gate ops

import type { ActivationState } from './milestones.ts';

export interface TrialStat {
  value: number;
  /** Singular and plural, because "1 tutors onboarded" reads as a bug. */
  label: string;
}

type CountedMetric = {
  [K in keyof ActivationState]: ActivationState[K] extends number ? K : never;
}[keyof ActivationState];

const STAT_LABELS: { key: CountedMetric; one: string; many: string }[] = [
  { key: 'learnersImported', one: 'student imported', many: 'students imported' },
  { key: 'tutorsInvited', one: 'tutor onboarded', many: 'tutors onboarded' },
  { key: 'bookings', one: 'session booked', many: 'sessions booked' },
  { key: 'invoices', one: 'invoice sent', many: 'invoices sent' },
];

/**
 * Only what actually happened. A zero is not a selling point — "0 invoices sent"
 * argues the other side's case — so an untouched metric is left out rather than
 * shown empty. A business that did nothing gets no stat block at all, which is
 * the honest version of that conversation.
 */
export function trialStats(activation: ActivationState): TrialStat[] {
  // `merchantOnboarded` is a boolean on the same state, so the keys are narrowed
  // to the counted ones rather than cast — a cast here would let a future flag
  // through as "true things onboarded".
  return STAT_LABELS.flatMap((stat) => {
    const value = activation[stat.key];
    if (typeof value !== 'number' || value <= 0) return [];
    return [{ value, label: value === 1 ? stat.one : stat.many }];
  });
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Doc 05 §6's copy, exactly: "Your trial ends Friday — everything you've set up
 * stays." A weekday inside a week is a date a person can feel; past that it is
 * a count, and after expiry the sentence stops being about time at all.
 *
 * The second clause is not decoration — it is the promise doc 05 §6 makes about
 * read-only grace, so it rides in the same string and cannot be dropped by a
 * layout that runs out of room.
 */
export function trialSentence(
  daysLeft: number | null,
  endsAt: string | null,
  now: Date = new Date(),
): string {
  if (daysLeft === null) return 'Everything you’ve set up stays.';
  if (daysLeft <= 0) return 'Your trial has ended — everything you’ve set up stays.';
  if (daysLeft === 1) return 'Your trial ends tomorrow — everything you’ve set up stays.';
  if (daysLeft <= 7 && endsAt) {
    const end = new Date(endsAt);
    if (!Number.isNaN(end.getTime())) {
      return `Your trial ends ${WEEKDAYS[end.getDay()]} — everything you’ve set up stays.`;
    }
  }
  return `${daysLeft} days left in your trial — everything you’ve set up stays.`;
}

/**
 * What a tier's gate says ON the card. Juicebox states the gate on the feature
 * itself rather than letting it be discovered at the moment of use, and doc 05
 * §6 asks for exactly that: "payroll gated at Studio is stated on the card, not
 * discovered later."
 */
export function tierGateNote(payoutAutomation: number): string {
  return payoutAutomation > 0
    ? 'Includes automated pay runs.'
    : 'Pay runs are manual on this tier — automation starts at Studio.';
}
