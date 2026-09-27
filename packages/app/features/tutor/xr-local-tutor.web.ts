'use client';
// There is no on-device LLM in the web bundle — the callers treat `null` as
// "the local model could not decide" and escalate, which is exactly what a
// browser should do for grading anyway.
// SOT: xr-local-tutor.native.ts
// SOT-KEYWORDS: xr local tutor web stub no on-device llm escalate
import type { XrLearningQuestion, XrQuestionOutcome } from '@acme/ui/xr';

export interface XrLocalVerdict {
  readonly outcome: Extract<XrQuestionOutcome, 'correct' | 'incorrect'>;
  readonly body: string;
}

export async function xrLocalGrade(
  _question: XrLearningQuestion,
  _answerText: string,
): Promise<XrLocalVerdict | null> {
  return null;
}

export async function xrLocalHint(_question: XrLearningQuestion): Promise<string | null> {
  return null;
}
