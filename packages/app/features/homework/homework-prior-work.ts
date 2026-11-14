import type { PriorWork, QuestionOutcome, SubmissionStatus } from './homework.types.ts';

/** The index stays in worksheet order; marked questions remain visible in progress. */
export function nextUndoneIndex(
  questions: readonly { readonly priorWork?: PriorWork }[],
  afterIndex = -1,
): number {
  return questions.findIndex((question, index) => index > afterIndex && question.priorWork !== 'complete');
}

/** Until a between-problems boundary exists, guardian edits end when tutoring starts. */
export function canRevisePriorWork(
  submission: { readonly tutorSessionId?: string | null; readonly status: SubmissionStatus },
  questions: readonly { readonly startedAt?: string | null; readonly outcome: QuestionOutcome }[],
): boolean {
  return !submission.tutorSessionId &&
    (submission.status === 'reviewing' || submission.status === 'ready' || submission.status === 'complete') &&
    questions.every((question) => !question.startedAt && question.outcome === 'unattempted');
}

/** Total includes every problem; learning outcomes include only work with Moyo. */
export function homeworkQuestionCounts(
  questions: readonly { readonly priorWork?: PriorWork; readonly outcome: QuestionOutcome }[],
): { questionCount: number; alreadyDoneCount: number; outcomes: Record<QuestionOutcome, number> } {
  const outcomes: Record<QuestionOutcome, number> = {
    unattempted: 0, skipped: 0, attempted: 0,
    'supported-with-hints': 0, 'solved-independently': 0, unresolved: 0,
  };
  let alreadyDoneCount = 0;
  for (const question of questions) {
    if (question.priorWork === 'complete') alreadyDoneCount += 1;
    else outcomes[question.outcome] += 1;
  }
  return { questionCount: questions.length, alreadyDoneCount, outcomes };
}
