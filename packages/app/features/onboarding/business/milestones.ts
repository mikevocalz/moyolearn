// The milestone checklist engine (doc 06 §8 PR-16), which S24 pins in the rail
// and S17 later sells against.
//
// Doc 05 §1.1 is the reason it is an engine and not a list of tick boxes on one
// screen: activation milestones drive B2B conversion, and the chart doc 05 §2.3
// wants is "trial→paid BY MILESTONE COUNT" — so completion has to be derived
// from the account's real state, never from a "dismissed the checklist" flag
// that says nothing about whether the business actually got value.
// SOT: docs/pack/06-auth-onboarding-spec.md §5 · docs/pack/05-monetization-access-spec.md §2.3
// SOT-KEYWORDS: onboarding business s24 milestone checklist activation trial engine

/** What the account has actually done. Every milestone is a function of this. */
export interface ActivationState {
  learnersImported: number;
  tutorsInvited: number;
  merchantOnboarded: boolean;
  bookings: number;
  invoices: number;
}

export const EMPTY_ACTIVATION: ActivationState = {
  learnersImported: 0,
  tutorsInvited: 0,
  merchantOnboarded: false,
  bookings: 0,
  invoices: 0,
};

export type MilestoneId = 'import' | 'tutors' | 'payments' | 'booking' | 'invoice';

export interface Milestone {
  id: MilestoneId;
  label: string;
  /** Why it matters to the business, in their words — not "complete your setup". */
  why: string;
  done: (state: ActivationState) => boolean;
}

/**
 * Ordered by dependency, not by importance: a first invoice cannot precede a
 * first booking, and showing them in any other order invites an operator to
 * start with the one they cannot finish.
 */
export const MILESTONES: Milestone[] = [
  {
    id: 'import',
    label: 'Import your students',
    why: 'Everything else hangs off the roster.',
    done: (s) => s.learnersImported > 0,
  },
  {
    id: 'tutors',
    label: 'Invite your tutors',
    why: 'They set their own hours, so you stop keeping the calendar.',
    done: (s) => s.tutorsInvited > 0,
  },
  {
    id: 'payments',
    label: 'Connect payments',
    why: 'Needed before you can invoice — families pay in the app.',
    done: (s) => s.merchantOnboarded,
  },
  {
    id: 'booking',
    label: 'Take your first booking',
    why: 'The moment the schedule stops living in a spreadsheet.',
    done: (s) => s.bookings > 0,
  },
  {
    id: 'invoice',
    label: 'Send your first invoice',
    why: 'Money in, without chasing anyone.',
    done: (s) => s.invoices > 0,
  },
];

export interface MilestoneProgress {
  done: number;
  total: number;
  /** The one to nudge — first unfinished in dependency order, or null when finished. */
  next: Milestone | null;
}

export function milestoneProgress(state: ActivationState): MilestoneProgress {
  const done = MILESTONES.filter((m) => m.done(state)).length;
  return { done, total: MILESTONES.length, next: MILESTONES.find((m) => !m.done(state)) ?? null };
}

/**
 * The rail chip (doc 05 §6 S17: "days left + milestone progress"). Copy stays on
 * the §6 line "everything you've set up stays" — a trial ending is not a threat,
 * and a countdown that implies otherwise is the dark pattern doc 05 §1.2 bans.
 */
export function trialChip(daysLeft: number, state: ActivationState): string {
  const { done, total } = milestoneProgress(state);
  if (daysLeft <= 0) return `Trial ended · ${done}/${total} set up · everything you built stays`;
  return `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left · ${done}/${total} set up`;
}
