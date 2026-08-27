// S22 learner first-run — the step machine, kept out of the component so the
// "zero forms, ≤2 minutes" contract is testable. Doc 06 §5 fixes the opening
// sequence — greeting → subject grid → one tiny win — and doc 37 §2 closes it
// with the guided first Snap. Every gate below is satisfiable by tapping;
// nothing here can ask a child to type.
// SOT: docs/pack/06-auth-onboarding-spec.md §5 · docs/pack/37-onboarding-dual-pane.md §2
// SOT-KEYWORDS: onboarding learner s22 first-run subjects tiny win snap steps

// `avatar` opens the run (doc 36 §2: redeem → avatar pick → baked greeting →
// Today). The set is CURATED, never an upload — doc 30 §8.4's child-safety
// decision: a photo path on a learner profile is a moderation and PII surface
// a curated set makes unnecessary.
// `snap` closes it (doc 37 §2's guided first Snap): a short "try it" beat that
// routes into the real capture flow — camera permission is asked AT the camera
// (doc 37 §1.5, guided-frame already does), so this step holds no permission
// prompt and no camera of its own, and it always offers an explicit skip.
export const LEARNER_STEPS = ['avatar', 'hello', 'subjects', 'win', 'snap'] as const;
export type LearnerStep = (typeof LEARNER_STEPS)[number];

export interface AvatarChoice {
  id: string;
  label: string;
  /** The rendered glyph — illustration-as-emoji keeps the set token-pure. */
  glyph: string;
}

/** Six choices, like the subject grid: a glance, not a menu (doc 06 §5). */
export const AVATAR_CHOICES: AvatarChoice[] = [
  { id: 'fox', label: 'Fox', glyph: '🦊' },
  { id: 'owl', label: 'Owl', glyph: '🦉' },
  { id: 'turtle', label: 'Turtle', glyph: '🐢' },
  { id: 'tiger', label: 'Tiger', glyph: '🐯' },
  { id: 'penguin', label: 'Penguin', glyph: '🐧' },
  { id: 'dragon', label: 'Dragon', glyph: '🐲' },
];

export type SubjectId = 'math' | 'reading' | 'writing' | 'science' | 'history' | 'languages';

export interface SubjectTile {
  id: SubjectId;
  label: string;
  /** One line under the label — what the child would actually be doing. */
  hint: string;
}

/** Big tiles, six of them: a grid a child reads at a glance, not a menu they parse. */
export const SUBJECT_TILES: SubjectTile[] = [
  { id: 'math', label: 'Math', hint: 'Numbers, shapes, and puzzles' },
  { id: 'reading', label: 'Reading', hint: 'Stories and what they mean' },
  { id: 'writing', label: 'Writing', hint: 'Getting your ideas down' },
  { id: 'science', label: 'Science', hint: 'How things work' },
  { id: 'history', label: 'History', hint: 'What happened, and why' },
  { id: 'languages', label: 'Languages', hint: 'New words to say out loud' },
];

/**
 * Nibble's onboarding caps topic selection at three and says so above the list.
 * The cap is the honest thing here too: doc 06 §5 gives this screen ~2 minutes,
 * and a child who taps all six has told us nothing.
 */
export const MAX_SUBJECTS = 3;

/** The one tiny win, per subject. One question, four taps, no typing. */
export interface WinItem {
  prompt: string;
  choices: string[];
  answerIndex: number;
  /** Shown after a wrong tap. Never "wrong" — doc 04 §S10's error voice. */
  notYet: string;
}

export const FIRST_WIN: Record<SubjectId, WinItem> = {
  math: {
    prompt: 'Which one is half of 12?',
    choices: ['4', '6', '8', '10'],
    answerIndex: 1,
    notYet: 'Not yet — half means the number twice over makes 12.',
  },
  reading: {
    prompt: '"The dog barked at the mail carrier." Who barked?',
    choices: ['The mail carrier', 'The dog', 'Nobody', 'Both of them'],
    answerIndex: 1,
    notYet: 'Not yet — look for who is doing the barking.',
  },
  writing: {
    prompt: 'Which sentence ends the right way?',
    choices: ['we went home', 'We went home', 'we went home.', 'We went home.'],
    answerIndex: 3,
    notYet: 'Not yet — a sentence opens with a capital and closes with a period.',
  },
  science: {
    prompt: 'Water turns into ice when it gets…',
    choices: ['Warmer', 'Colder', 'Louder', 'Heavier'],
    answerIndex: 1,
    notYet: 'Not yet — think about where you keep ice.',
  },
  history: {
    prompt: 'Which happened first?',
    choices: ['The first airplane flight', 'The first pyramids', 'The first phone call', 'The first car'],
    answerIndex: 1,
    notYet: 'Not yet — the pyramids are thousands of years older than the rest.',
  },
  languages: {
    prompt: 'In Spanish, "hola" means…',
    choices: ['Goodbye', 'Hello', 'Please', 'Thank you'],
    answerIndex: 1,
    notYet: 'Not yet — it is the word you start with, not the one you leave with.',
  },
};

export type WinResult = 'correct' | 'not-yet' | null;

export interface LearnerDraft {
  /** From the guardian's S21 child row; the tutor greets by it, never asks for it. */
  firstName: string;
  /** The curated pick. Null until tapped — the avatar step gates on it. */
  avatar: string | null;
  subjects: SubjectId[];
  result: WinResult;
}

export const EMPTY_LEARNER_DRAFT: LearnerDraft = {
  firstName: '',
  avatar: null,
  subjects: [],
  result: null,
};

/** The item is chosen by the first subject tapped, so the win is about what they came for. */
export function winItem(draft: LearnerDraft): WinItem {
  return FIRST_WIN[draft.subjects[0] ?? 'math'];
}

/** H5 (error prevention): forward is disabled until it is actually available — never a dead tap. */
export function canAdvance(step: LearnerStep, draft: LearnerDraft): boolean {
  switch (step) {
    case 'avatar':
      // One tap satisfies it — nothing here can ask a child to type.
      return draft.avatar !== null;
    case 'hello':
      return true;
    case 'subjects':
      return draft.subjects.length > 0 && draft.subjects.length <= MAX_SUBJECTS;
    case 'win':
      // Moving on is earned by the win, not by waiting it out: doc 06 §5 makes
      // the tiny win the point of the screen, and a Skip would make it optional.
      return draft.result === 'correct';
    case 'snap':
      // The Snap is an invitation, never a gate (doc 37 §2's explicit skip):
      // a child with no homework in reach still finishes onboarding.
      return true;
  }
}

/** Tap toggles; over the cap the tap is refused rather than silently dropping the oldest. */
export function toggleSubject(subjects: SubjectId[], id: SubjectId): SubjectId[] {
  if (subjects.includes(id)) return subjects.filter((s) => s !== id);
  if (subjects.length >= MAX_SUBJECTS) return subjects;
  return [...subjects, id];
}

export function nextStep(step: LearnerStep): LearnerStep | null {
  const i = LEARNER_STEPS.indexOf(step);
  return LEARNER_STEPS[i + 1] ?? null;
}

/** Duolingo ABC keeps a back arrow beside the progress bar on every step but the first. */
export function previousStep(step: LearnerStep): LearnerStep | null {
  const i = LEARNER_STEPS.indexOf(step);
  return i > 0 ? LEARNER_STEPS[i - 1]! : null;
}

export function stepProgress(step: LearnerStep): { index: number; total: number } {
  return { index: LEARNER_STEPS.indexOf(step) + 1, total: LEARNER_STEPS.length };
}
