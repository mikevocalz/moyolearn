// The worksheet half of a session report: one problems-block row per
// homework question, the facts block recounted from outcomes, and block 6's
// next step derived from misconception tags and outcome counts.
//
// The narrative model never sees a revision. `narrativeEvidence` blanks the
// session's `problem` (a homework session's problem is a copy of the current
// question's text) and the rows below carry the text only inside `questionRef`,
// which `narrativePayload` does not serialize. The server test pins both.
//
// Outcome words come from the contract's §Report mapping. Nothing here claims
// a question was answered correctly: `evaluationReady` stays false for a
// photographed page, so "finished without hints" is the strongest statement
// the evidence supports.
// SOT: docs/work/pr-100/contract.md §Report · docs/pack/34-session-summary-reports.md §2.3 · docs/decisions/adr-119-graded-turns-need-a-locked-revision.md
// SOT-KEYWORDS: homework report problem row outcome mapping misconception next step facts worksheet no transcript
import type { HomeworkSubmissionView, QuestionOutcome } from '../homework/homework.types.ts';
import type { ExtractedEvidence } from './evidence.ts';
import { lintNarrative, type NarrativeCandidate } from './honesty.ts';
import type { EvidenceRef, ProblemRow, ProblemStatus, SummaryFacts } from './summary.types.ts';

/** Contract §Report. Everything that is not a finish is still being worked. */
export function statusForOutcome(outcome: QuestionOutcome): ProblemStatus {
  if (outcome === 'solved-independently') return 'solved-independently';
  if (outcome === 'supported-with-hints') return 'solved-with-help';
  return 'still-working';
}

/** One row per question, in worksheet order. No answer text: there is no transcript to quote. */
export function homeworkProblemRows(submission: HomeworkSubmissionView): ProblemRow[] {
  return [...submission.questions]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((question) => ({
      subject: submission.subject,
      skillId: `homework-question:${question.questionId}`,
      questionRef: { kind: 'homework-question', questionId: question.questionId, text: question.text },
      childAnswer: null,
      attempts: question.attempts,
      status: statusForOutcome(question.outcome),
      submittedIncorrect: false,
      orderInSession: question.orderIndex,
      homework: {
        orderIndex: question.orderIndex,
        sourcePage: question.sourcePage,
        sourceNumber: question.sourceNumber,
        outcome: question.outcome,
        hintsUsed: question.hintsUsed,
      },
    }));
}

const NOT_WORKED: ReadonlySet<QuestionOutcome> = new Set(['unattempted', 'skipped']);

/** Block 8 recounted from outcomes; duration stays the session's own. */
export function homeworkFacts(
  submission: HomeworkSubmissionView,
  durationMin: number,
): SummaryFacts {
  const count = (test: (outcome: QuestionOutcome) => boolean) =>
    submission.questions.filter((question) => test(question.outcome)).length;
  return {
    durationMin,
    attempted: count((outcome) => !NOT_WORKED.has(outcome)),
    solvedIndependently: count((outcome) => outcome === 'solved-independently'),
    solvedWithHelp: count((outcome) => outcome === 'supported-with-hints'),
  };
}

/**
 * The evidence the narrative, the lint and the screen see for a worksheet
 * session. Graded skills from `edu.transcripts` stay; the chat-derived
 * problems block is replaced by the worksheet rows and the problem text is
 * blanked so no revision reaches the model prompt.
 */
export function narrativeEvidence(
  evidence: ExtractedEvidence,
  submission: HomeworkSubmissionView,
): ExtractedEvidence {
  const problems = homeworkProblemRows(submission);
  const evidenceRefs: EvidenceRef[] = [
    ...evidence.evidenceRefs.filter((ref) => ref.kind !== 'problem'),
    ...problems.map((row): EvidenceRef => ({ kind: 'problem', id: `#${String(row.orderInSession)}` })),
  ];
  return {
    ...evidence,
    problem: '',
    problems,
    facts: homeworkFacts(submission, evidence.facts.durationMin),
    evidenceRefs,
  };
}

/** A tag a parent can read: lowercase words only, so it cannot carry a digit or markup. */
const READABLE_TAG = /^[a-z][a-z -]{1,47}$/;

const humanTag = (tag: string): string | null => {
  const words = tag.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  return READABLE_TAG.test(words) ? words : null;
};

/**
 * Block 6 for a worksheet session. Inputs are the misconception tags the
 * tutor logged and the outcome counts; nothing else. Two sentences are tried
 * in order, the tagged one first, and each must pass the honesty lint as the
 * candidate's `nextUp`. The tag-free sentence uses no tag and no number, so
 * the last fallback cannot fail the numeric or lexicon rules.
 */
export function homeworkNextStep(
  submission: HomeworkSubmissionView,
  evidence: ExtractedEvidence,
  candidate: NarrativeCandidate,
): string {
  const open = submission.questions.filter((q) => statusForOutcome(q.outcome) === 'still-working');
  const helped = submission.questions.filter((q) => q.outcome === 'supported-with-hints');
  const tags = [
    ...new Set(
      submission.questions
        .filter((q) => q.outcome !== 'solved-independently')
        .flatMap((q) => q.misconceptionTags)
        .map(humanTag)
        .filter((tag): tag is string => tag !== null),
    ),
  ].slice(0, 2);

  const rest =
    open.length > 0
      ? open.length === 1
        ? 'the question still open on this worksheet'
        : 'the questions still open on this worksheet'
      : helped.length > 0
        ? 'the worksheet questions that needed hints'
        : null;

  const tagged =
    tags.length === 0
      ? null
      : rest === null
        ? `Next session goes back over ${tags.join(' and ')}, the pattern the tutor noted on this worksheet.`
        : `Next session goes back over ${tags.join(' and ')}, starting with ${rest}.`;
  const plain = rest === null ? 'Next session starts from a new worksheet.' : `Next session picks up ${rest}.`;

  for (const sentence of [tagged, plain]) {
    if (sentence === null) continue;
    if (lintNarrative({ ...candidate, nextUp: sentence }, evidence).every((v) => v.field !== 'nextUp')) {
      return sentence;
    }
  }
  return plain;
}

/**
 * Block 1 when the worksheet carried no graded turn, which is the common case
 * for a photographed page. The deterministic headline would otherwise say the
 * session had no problems while block 3 lists the whole worksheet.
 */
export function homeworkHeadline(facts: SummaryFacts): string {
  return `Worked through ${String(facts.attempted)} worksheet questions: ${String(facts.solvedIndependently)} without hints, ${String(facts.solvedWithHelp)} with hints.`;
}
