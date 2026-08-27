// S23 tutor onboarding — the step machine. Doc 37 §2 reordered doc 06 §5's
// sequence: account (Google-first) → connect (the org invite code FIRST — a
// tutor arriving from a school's email should land their invite before
// building a profile the org may pre-fill) → profile + subjects + credentials
// → availability → a SessionPrepCard preview on demo data. The metric this
// screen is judged on is "availability completed", so availability is the one
// step with a gate that cannot be waved through — everything genuinely
// optional says so. `preview` stays for now; PR-147 moves its teaching to the
// first Notes visit.
// SOT: docs/pack/06-auth-onboarding-spec.md §5 · docs/pack/37-onboarding-dual-pane.md §2
// SOT-KEYWORDS: onboarding tutor s23 steps invite connect profile subjects credentials availability

export const TUTOR_STEPS = ['account', 'connect', 'profile', 'availability', 'preview'] as const;
export type TutorStep = (typeof TUTOR_STEPS)[number];

export type TeachableSubject =
  | 'math'
  | 'reading'
  | 'writing'
  | 'science'
  | 'history'
  | 'languages'
  | 'test-prep';

export const TEACHABLE_SUBJECTS: { id: TeachableSubject; label: string }[] = [
  { id: 'math', label: 'Math' },
  { id: 'reading', label: 'Reading' },
  { id: 'writing', label: 'Writing' },
  { id: 'science', label: 'Science' },
  { id: 'history', label: 'History' },
  { id: 'languages', label: 'Languages' },
  { id: 'test-prep', label: 'Test prep' },
];

/**
 * Upwork's profile builder opens a category and then says "now select 1 to 3
 * specialties". Three is the number that still means something to a family
 * reading the profile; a tutor who teaches everything has said nothing.
 */
export const MAX_TEACHABLE = 3;

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export type Day = (typeof DAYS)[number];

export const BLOCKS = ['morning', 'afternoon', 'evening'] as const;
export type Block = (typeof BLOCKS)[number];

/** `Mon-afternoon`. A set of these is the whole availability model at this stage. */
export type Slot = `${Day}-${Block}`;

export const slot = (day: Day, block: Block): Slot => `${day}-${block}`;

/**
 * "Seeded with sensible defaults" (doc 06 §5) means the step is already passable
 * on arrival: after-school on weekdays is when school-age tutoring actually
 * happens, so the tutor edits a real answer instead of filling an empty grid.
 * The full AvailabilityEditor lives in the calendar engine (doc 01) and will
 * replace this grid; the defaults are the part that belongs to onboarding.
 */
export const DEFAULT_SLOTS: Slot[] = [
  'Mon-afternoon', 'Tue-afternoon', 'Wed-afternoon', 'Thu-afternoon', 'Fri-afternoon',
  'Mon-evening', 'Tue-evening', 'Wed-evening', 'Thu-evening',
];

export interface Credential {
  name: string;
  uri: string;
}

export interface TutorDraft {
  email: string;
  /** Google-first (doc 06 §5) — the email path is the fallback, not the headline. */
  google: boolean;
  displayName: string;
  headline: string;
  subjects: TeachableSubject[];
  credentials: Credential[];
  slots: Slot[];
  /** An org invite code they were given, or blank if they came in independently. */
  inviteCode: string;
}

export const EMPTY_TUTOR_DRAFT: TutorDraft = {
  email: '',
  google: false,
  displayName: '',
  headline: '',
  subjects: [],
  credentials: [],
  slots: DEFAULT_SLOTS,
  inviteCode: '',
};

export function canAdvance(step: TutorStep, draft: TutorDraft): boolean {
  switch (step) {
    case 'account':
      return draft.google || /.+@.+\..+/.test(draft.email);
    case 'profile':
      // Credentials are deliberately NOT gated: doc 05 §5 puts verification on a
      // review path, and an unverified tutor who can still finish onboarding is
      // a tutor we can invite to a session. The badge is the incentive.
      return (
        draft.displayName.trim().length > 0 &&
        draft.subjects.length > 0 &&
        draft.subjects.length <= MAX_TEACHABLE
      );
    case 'availability':
      return draft.slots.length > 0;
    case 'connect':
      // Skippable on purpose: an independent tutor has nobody to connect to yet,
      // and blocking them here loses the supply doc 06 §5 is trying to retain.
      return true;
    case 'preview':
      return true;
  }
}

export function toggleSubject(
  subjects: TeachableSubject[],
  id: TeachableSubject,
): TeachableSubject[] {
  if (subjects.includes(id)) return subjects.filter((s) => s !== id);
  if (subjects.length >= MAX_TEACHABLE) return subjects;
  return [...subjects, id];
}

export function toggleSlot(slots: Slot[], value: Slot): Slot[] {
  return slots.includes(value) ? slots.filter((s) => s !== value) : [...slots, value];
}

/** Human summary for the review line — "9 blocks across Mon–Fri". */
export function summariseSlots(slots: Slot[]): string {
  if (slots.length === 0) return 'No times yet';
  const days = DAYS.filter((d) => slots.some((s) => s.startsWith(`${d}-`)));
  return `${slots.length} ${slots.length === 1 ? 'block' : 'blocks'} across ${days.join(', ')}`;
}

/**
 * Angi keeps a "Not now" on optional steps; Upwork labels the forward button
 * with where it goes rather than "Continue". Both need to know what is next.
 */
export function nextStep(step: TutorStep): TutorStep | null {
  const i = TUTOR_STEPS.indexOf(step);
  return TUTOR_STEPS[i + 1] ?? null;
}

export function previousStep(step: TutorStep): TutorStep | null {
  const i = TUTOR_STEPS.indexOf(step);
  return i > 0 ? TUTOR_STEPS[i - 1]! : null;
}

export function stepProgress(step: TutorStep): { index: number; total: number } {
  return { index: TUTOR_STEPS.indexOf(step) + 1, total: TUTOR_STEPS.length };
}

/** The label on the forward button: where it goes, not what it does. */
export const STEP_DESTINATION: Record<TutorStep, string> = {
  account: 'Connect a school or family',
  connect: 'Build your profile',
  profile: 'Set your hours',
  availability: 'See your session prep',
  preview: 'Finish',
};

/** Steps a tutor may pass through untouched, and what they lose by doing it. */
export const OPTIONAL_STEPS: Partial<Record<TutorStep, string>> = {
  connect: 'You can join a school or a family later from your profile.',
};
