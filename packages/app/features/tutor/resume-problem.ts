// SOT: packages/app/features/tutor/tutor.store.ts
// SOT-KEYWORDS: tutor resume problem worksheet cursor rollover hydrate

export interface ResumedProblem {
  /** The thread's own first problem: the opening bubble of the transcript. */
  readonly opener: string;
  /** The problem the next coaching turn is about. */
  readonly coaching: string;
}

/**
 * What a resumed tutor thread shows first, and what it coaches on next.
 *
 * An open thread keeps the problem it was created with, but a worksheet's
 * cursor moves on: to the next question, or to a newer assignment after a
 * finished sheet. So the device's problem wins for coaching only when it IS the
 * worksheet cursor's question (`onWorksheetCursor`, decided from question
 * identity, never from the reading flag a photo also sets). The transcript
 * keeps its original opener either way, so earlier turns still sit under the
 * question they answered.
 */
export function resumedProblem(threadProblem: string, localProblem: string, onWorksheetCursor: boolean): ResumedProblem {
  const opener = threadProblem.length > 0 ? threadProblem : localProblem;
  const coaching = onWorksheetCursor && localProblem.trim().length > 0 ? localProblem : opener;
  return { opener, coaching };
}

/** True when the device's problem is the question the worksheet cursor is on. */
export function isOnWorksheetCursor(
  worksheet: { readonly questions: readonly { readonly questionId: string }[]; readonly currentIndex: number } | null,
  evidence: { readonly questionId: string } | null,
): boolean {
  if (worksheet === null || evidence === null) return false;
  return worksheet.questions[worksheet.currentIndex]?.questionId === evidence.questionId;
}
