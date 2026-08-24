// S25 teacher onboarding — the step machine. Doc 06 §5: Google in → school/class
// setup → roster → first assignment from a template.
//
// The rule this file exists to make unbreakable: **a teacher never creates a
// child account.** Under 13, the only route in is a guardian-mediated join link
// that runs the consent ladder on the guardian's side (doc 06 §2/§5); 13+ may
// redeem a class code themselves. That is not a UI preference — it is which of
// the two flows is lawful — so the join methods are DERIVED from the class's
// grade band rather than chosen from a menu.
// SOT: docs/pack/06-auth-onboarding-spec.md §5
// SOT-KEYWORDS: onboarding teacher s25 class roster join code guardian link assignment

export const TEACHER_STEPS = ['account', 'class', 'roster', 'assignment'] as const;
export type TeacherStep = (typeof TEACHER_STEPS)[number];

/** Bands are the shape a teacher actually thinks in; the 13 line runs through 6–8. */
export type GradeBand = 'k-5' | '6-8' | '9-12' | 'mixed';

export const GRADE_BANDS: { id: GradeBand; label: string; note: string }[] = [
  { id: 'k-5', label: 'K–5', note: 'Everyone is under 13' },
  { id: '6-8', label: '6–8', note: 'Some students are under 13' },
  { id: '9-12', label: '9–12', note: 'Students can join themselves' },
  { id: 'mixed', label: 'Mixed ages', note: 'We’ll route each student by their date of birth' },
];

export type JoinMethod = 'class-code' | 'guardian-link';

export interface JoinOption {
  method: JoinMethod;
  label: string;
  /** Duolingo for Schools states what joining GRANTS above the input. So do we. */
  grants: string;
}

const CLASS_CODE: JoinOption = {
  method: 'class-code',
  label: 'Class code',
  grants: 'Lets you see their work in this class and send them assignments.',
};

const GUARDIAN_LINK: JoinOption = {
  method: 'guardian-link',
  label: 'Guardian join link',
  grants:
    'Goes to a parent or guardian, who creates the account and gives consent. You never see the login.',
};

/**
 * Which routes in are lawful for this class. A band containing under-13s always
 * carries the guardian link; `9-12` is the only band where a student may redeem
 * a code unaccompanied. `mixed` offers both because the code path asks for a
 * date of birth at redemption and sends minors down the guardian route anyway —
 * the teacher never has to know who is 12.
 */
export function joinOptions(band: GradeBand): JoinOption[] {
  switch (band) {
    case 'k-5':
      return [GUARDIAN_LINK];
    case '6-8':
      return [GUARDIAN_LINK, CLASS_CODE];
    case '9-12':
      return [CLASS_CODE];
    case 'mixed':
      return [GUARDIAN_LINK, CLASS_CODE];
  }
}

/** True only where an unaccompanied student may redeem a code. */
export const allowsSelfJoin = (band: GradeBand) =>
  joinOptions(band).some((o) => o.method === 'class-code');

/**
 * Duolingo for Schools uses a short fixed-length code, read aloud or projected.
 * `I O 0 1 L` are out: a code read across a classroom cannot afford a character
 * that is two characters depending on the font.
 */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;

export function classCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  }
  return code;
}

export interface AssignmentTemplate {
  id: string;
  title: string;
  /** What the student is asked to do — the teacher is picking work, not a form. */
  description: string;
  minutes: number;
}

/**
 * Doc 06 §5's metric for this screen is "first assignment sent", so the last step
 * hands over finished work rather than an empty composer. Templates are editable
 * after sending; a blank page on day one is how the metric goes unmet.
 */
export const ASSIGNMENT_TEMPLATES: AssignmentTemplate[] = [
  {
    id: 'practice-set',
    title: 'Practice set',
    description: 'Ten questions on one skill, with the help ladder available on each.',
    minutes: 15,
  },
  {
    id: 'reading-response',
    title: 'Reading response',
    description: 'Read a passage, then answer in their own words.',
    minutes: 20,
  },
  {
    id: 'skill-check',
    title: 'Skill check',
    description: 'A short diagnostic that tells you where the class actually is.',
    minutes: 10,
  },
  {
    id: 'catch-up',
    title: 'Catch-up work',
    description: 'Targets whatever each student got wrong most recently.',
    minutes: 15,
  },
];

export interface TeacherDraft {
  email: string;
  google: boolean;
  school: string;
  className: string;
  gradeBand: GradeBand | null;
  code: string;
  /** Guardian addresses the join link goes to — never the students'. */
  guardianEmails: string[];
  templateId: string | null;
  assignmentSent: boolean;
}

export const EMPTY_TEACHER_DRAFT: TeacherDraft = {
  email: '',
  google: false,
  school: '',
  className: '',
  gradeBand: null,
  code: '',
  guardianEmails: [],
  templateId: null,
  assignmentSent: false,
};

export function canAdvance(step: TeacherStep, draft: TeacherDraft): boolean {
  switch (step) {
    case 'account':
      return draft.google || /.+@.+\..+/.test(draft.email);
    case 'class':
      // The band decides which join routes are lawful, so it cannot be skipped
      // and defaulted later — a default here would be a legal guess.
      return draft.className.trim().length > 0 && draft.gradeBand !== null;
    case 'roster':
      // Filling the roster is the metric, not the gate: a teacher setting up in
      // August has no addresses yet, and the code works whether or not they do.
      return true;
    case 'assignment':
      return draft.templateId !== null;
  }
}

export function nextStep(step: TeacherStep): TeacherStep | null {
  const i = TEACHER_STEPS.indexOf(step);
  return TEACHER_STEPS[i + 1] ?? null;
}

export function previousStep(step: TeacherStep): TeacherStep | null {
  const i = TEACHER_STEPS.indexOf(step);
  return i > 0 ? TEACHER_STEPS[i - 1]! : null;
}

export function stepProgress(step: TeacherStep): { index: number; total: number } {
  return { index: TEACHER_STEPS.indexOf(step) + 1, total: TEACHER_STEPS.length };
}
