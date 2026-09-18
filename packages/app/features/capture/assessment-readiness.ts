// Shared client/server assessment gate. Missing provenance must never mean verified.
// SOT: docs/design/homework-intelligence.md
// SOT-KEYWORDS: homework source uncertainty assessment grading mastery readiness
export const assessmentReadiness = {
  verified: 'verified',
  unresolved: 'unresolved',
} as const;

export type AssessmentReadiness =
  (typeof assessmentReadiness)[keyof typeof assessmentReadiness];

export function readyForEvaluation(value: string | undefined): boolean {
  return value === assessmentReadiness.verified;
}

export function readinessForTurn(source: {
  problemIsReading: boolean;
  hasRecognizedInput: boolean;
}): AssessmentReadiness {
  return source.problemIsReading || source.hasRecognizedInput
    ? assessmentReadiness.unresolved
    : assessmentReadiness.verified;
}
