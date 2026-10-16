// The pure half of practice-set generation: which skills a submission says
// need another pass, the draft built from them, and who may hold it.
//
// Two sources pick the skills, in this order. A misconception tag the tutor
// recorded on a question names its skill outright (`MISCONCEPTIONS[tag].skillId`),
// so it ranks first. A question whose outcome was `supported-with-hints` or
// `unresolved` names no skill, so its confirmed text is classified by shape
// below. `attempted` and `skipped` are left out: neither says the child needed
// help, and a skipped question says nothing at all.
//
// Nothing here grades. The tags come from tutoring outcomes, never from a
// checked answer, and the draft's items are new problems with a key the
// checker vouched for. The key belongs to the adult: `canHoldPracticeKey`
// refuses a learner account outright, and refuses a guardian whose
// guardianship of that child is no longer active.
// SOT: docs/work/pr-100/contract.md §Practice sets · docs/design/homework-end-to-end-2026.md · packages/app/features/capture/assessment-readiness.ts
// SOT-KEYWORDS: practice draft skill tag misconception outcome supported unresolved classify guardian key ward
import {
  generatePracticeSet,
  isMisconceptionTag,
  isPracticeSkillTag,
  MISCONCEPTIONS,
  verifyPracticeItems,
  type DroppedPracticeItem,
  type PracticeSkillTag,
  type VoiceBand,
} from '@acme/student-model/pure';
import type {
  HomeworkQuestionView,
  HomeworkSubmissionView,
  PracticeSetView,
  QuestionOutcome,
} from './homework.types.ts';

/** At most this many skills per sheet; a sheet that targets everything targets nothing. */
export const MAX_TARGETED_TAGS = 3;
export const PRACTICE_ITEM_COUNT = 8;

const NEEDED_HELP: ReadonlySet<QuestionOutcome> = new Set(['supported-with-hints', 'unresolved']);

const FRACTION = /\d+\s*\/\s*\d+/;
const DECIMAL = /\d\.\d/;
const VARIABLE = /(?<![a-z])x(?![a-z])/i;
// A minus glued to its digit after the start, a space or another operator: `-4 + 7`, `5 - -3`. `7 - 3` is subtraction.
const NEGATIVE_OPERAND = /(^|[\s(+\-×*÷/=])-\d/;
const MULTIPLY = /[×*]/;
const DIVIDE = /[÷]|\d\s*\/\s*\d/;

/**
 * The practice skill a confirmed question's text most plausibly exercises, or
 * null when its shape matches none of the generator's families. A word
 * problem or a percent question returns null on purpose: the generator has no
 * verified template for it, and guessing a neighbouring skill would hand the
 * adult a sheet about something the child did not struggle with.
 */
export function practiceTagForText(text: string): PracticeSkillTag | null {
  // "3 x 4" is a times sign, not an unknown; spaced on both sides is how worksheets print it.
  // Generated and OCR'd text both carry U+2212 and en dashes for minus.
  const t = text
    .toLowerCase()
    .replace(/[\u2212\u2013]/g, '-')
    .replace(/(\d)\s+x\s+(\d)/g, '$1×$2');
  if (t.includes('%') || t.includes('percent')) return null;
  if (VARIABLE.test(t) && t.includes('=')) {
    const [lhs = '', rhs = ''] = t.split('=');
    if (VARIABLE.test(lhs) && VARIABLE.test(rhs)) return 'linear-both-sides';
    const side = VARIABLE.test(lhs) ? lhs : rhs;
    const operations = (side.match(/[+\-×*÷/]|\dx/g) ?? []).length;
    return operations >= 2 ? 'linear-two-step' : 'equation-sense';
  }
  if (FRACTION.test(t)) {
    if (/[×*]|\bof\b/.test(t)) return 'fraction-multiplication';
    if (/\d\s*\/\s*\d+\s*-\s*\d/.test(t)) return 'fraction-subtraction';
    if (t.includes('+')) return 'fraction-addition';
    return 'fraction-sense';
  }
  if (DECIMAL.test(t)) return 'decimal-sense';
  if (NEGATIVE_OPERAND.test(t)) return 'integer-operations';
  const operators = new Set(t.match(/[+\-×*÷/]/g) ?? []);
  if (t.includes('(') || operators.size >= 2) return 'order-of-operations';
  if (MULTIPLY.test(t)) return 'multiplication-facts';
  if (DIVIDE.test(t)) return 'division-facts';
  const numbers = (t.match(/\d+/g) ?? []).map(Number);
  if (numbers.length === 0) return null;
  const small = numbers.every((n) => n <= 20);
  if (operators.has('-')) return small ? 'subtraction-within-20' : 'subtraction-multi-digit';
  if (operators.has('+')) return small ? 'addition-within-20' : 'addition-multi-digit';
  return null;
}

/** Misconception skills first, then help-needed questions in worksheet order; deduplicated and capped. */
export function pickPracticeTags(questions: readonly HomeworkQuestionView[]): readonly PracticeSkillTag[] {
  const fromMisconceptions: PracticeSkillTag[] = [];
  const fromOutcomes: PracticeSkillTag[] = [];
  const ordered = [...questions].sort((a, b) => a.orderIndex - b.orderIndex);
  for (const question of ordered) {
    for (const tag of question.misconceptionTags) {
      if (isMisconceptionTag(tag)) fromMisconceptions.push(MISCONCEPTIONS[tag].skillId);
      else if (isPracticeSkillTag(tag)) fromMisconceptions.push(tag);
    }
    if (NEEDED_HELP.has(question.outcome)) {
      const inferred = practiceTagForText(question.text);
      if (inferred) fromOutcomes.push(inferred);
    }
  }
  return [...new Set([...fromMisconceptions, ...fromOutcomes])].slice(0, MAX_TARGETED_TAGS);
}

export interface PracticeDraftInput {
  readonly submission: HomeworkSubmissionView;
  readonly band: VoiceBand;
  /** Doubles as the seed, so the approved sheet regenerates byte-for-byte from the row. */
  readonly practiceSetId: string;
  readonly now: string;
}

export interface PracticeDraft {
  readonly view: PracticeSetView;
  readonly dropped: readonly DroppedPracticeItem[];
}

/**
 * Generate, verify, keep what verified. `targetedTags` is empty when the
 * submission surfaced no skill the generator knows; the generator then draws
 * on the band's defaults and the preview says so rather than implying a
 * targeting it did not do.
 */
export function buildPracticeDraft(input: PracticeDraftInput): PracticeDraft {
  const targetedTags = pickPracticeTags(input.submission.questions);
  const generated = generatePracticeSet({
    seed: input.practiceSetId,
    skillTags: targetedTags,
    band: input.band,
    count: PRACTICE_ITEM_COUNT,
  });
  const { kept, dropped } = verifyPracticeItems(generated);
  return {
    view: {
      practiceSetId: input.practiceSetId,
      submissionId: input.submission.submissionId,
      learnerAuthId: input.submission.learnerAuthId,
      status: 'draft',
      seed: input.practiceSetId,
      targetedTags,
      items: kept,
      createdAt: input.now,
    },
    dropped,
  };
}

/**
 * The answer key's holder: a guardian account with an ACTIVE guardianship of
 * the learner. A learner never holds a key, their own included, because the
 * key is the one part of a practice set that would read as an answer mode.
 */
export function canHoldPracticeKey(
  caller: { readonly learnerId: string; readonly isLearner: boolean },
  wards: readonly string[],
  learnerAuthId: string,
): boolean {
  if (caller.isLearner) return false;
  if (learnerAuthId === caller.learnerId) return false;
  return wards.includes(learnerAuthId);
}
