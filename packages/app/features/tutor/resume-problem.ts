// SOT: packages/app/features/tutor/tutor.store.ts
// SOT-KEYWORDS: tutor resume problem worksheet cursor rollover hydrate

/**
 * The problem a resumed tutor thread coaches on.
 *
 * An open thread keeps the problem it was created with, but a worksheet's
 * cursor moves on: to the next question, or to a newer assignment after a
 * finished sheet. Coaching reads the store's problem, so a worksheet question
 * on this device outranks the thread's first one. Anything else resumes the
 * thread as it was, so a device joining a conversation does not overwrite it.
 */
export function resumedProblem(threadProblem: string, localProblem: string, localIsReading: boolean): string {
  if (localIsReading && localProblem.trim().length > 0) return localProblem;
  return threadProblem.length > 0 ? threadProblem : localProblem;
}
