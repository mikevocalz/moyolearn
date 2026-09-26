'use client';
/**
 * The XR question evaluator — the seam between the question-flow store's
 * `submit`/`resolveSubmit` pair and the server's one grading path.
 *
 * ONE RULE: correctness is server-authoritative. `server-objective`
 * questions POST the same `/api/tutor/evaluate` the 2D tutor uses, carrying
 * the issued `questionId`/`revision` evidence pair — the store never
 * invents a verdict, and a question that arrives without evidence can only
 * ever resolve `ungraded`. `coach-review`/`teacher-review` resolve
 * honestly: the answer is recorded, the verdict is "reviewed with your
 * tutor", not a fake tick.
 *
 * WHAT THE SERVER UNDERSTANDS TODAY bounds what this file can ask: the
 * evaluator is exact-arithmetic on `problem`/`answer` strings (see
 * `evaluateTutorTurn`). An interaction the wire shape cannot express —
 * diagram placements, orderings, board work — resolves `ungraded` rather
 * than pretending to grade. That is the spec's "unsupported interactions
 * fall back honestly" clause, enforced in one place.
 *
 * SOT: apps/web/app/api/tutor/evaluate/route.ts ·
 *      packages/app/features/tutor/tutor.service.ts · xr-question.store.ts
 * SOT-KEYWORDS: xr question evaluator server authoritative evidence revision answer draft fallback ungraded
 */

import { API_URL } from '../../core/api-url.ts';
import type {
  XrAnswerDraft,
  XrLearningQuestion,
  XrQuestionFeedback,
} from '@acme/ui/xr';

/** The route's wire shape — `POST /api/tutor/evaluate`. */
interface EvaluateResponse {
  skillTitle: string;
  /** `null` is the server's honest "could not resolve" — NOT a wrong answer. */
  isCorrect: boolean | null;
}

/** The draft → the `answer` string the evaluator reads. Returns `null`
    for interactions the exact-arithmetic path cannot express — the caller
    resolves those `ungraded` rather than shipping a half-answer. */
export function draftAnswerText(question: XrLearningQuestion, draft: XrAnswerDraft): string | null {
  switch (draft.kind) {
    case 'choices': {
      /* Choice labels are the answer text — the server digests the
         problem string and compares the answer, so the label the child
         saw is the honest payload. */
      const labels = draft.selectedIds
        .map((id) => question.choices?.find((c) => c.id === id)?.label)
        .filter((l): l is string => typeof l === 'string');
      return labels.length > 0 ? labels.join(', ') : null;
    }
    case 'text': return draft.text.trim().length > 0 ? draft.text.trim() : null;
    case 'expression': return draft.expression.trim().length > 0 ? draft.expression.trim() : null;
    case 'voice': return draft.transcript.trim().length > 0 ? draft.transcript.trim() : null;
    default:
      /* ordering / labels / board / none — not expressible on the
         evaluate wire. */
      return null;
  }
}

/**
 * Resolve one submitted draft. `hintDepth` mirrors the 2D tutor's field —
 * the XR flow's hint sheet counts uses the same way.
 */
export async function evaluateXrAnswer(
  question: XrLearningQuestion,
  draft: XrAnswerDraft,
  hintDepth = 0,
): Promise<XrQuestionFeedback> {
  /* Evaluation kind is the question's own contract — see question-contract. */
  if (question.evaluation.kind === 'ungraded') {
    return { outcome: 'ungraded', title: 'Noted', body: 'Your answer was recorded.' };
  }
  if (question.evaluation.kind === 'coach-review' || question.evaluation.kind === 'teacher-review') {
    return {
      outcome: 'ungraded',
      title: 'Sent for review',
      body: 'Your tutor will look at this with you.',
    };
  }
  const answer = draftAnswerText(question, draft);
  if (answer === null || !question.evidence) {
    return {
      outcome: 'ungraded',
      title: 'Answered',
      body: 'This one is reviewed by your tutor, not auto-checked.',
    };
  }
  try {
    const response = await fetch(`${API_URL}/api/tutor/evaluate`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        problem: question.prompt,
        answer,
        hintDepth,
        evidence: question.evidence,
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
    const result = (await response.json()) as EvaluateResponse;
    /* `null` — the server could not resolve it. Not a wrong answer; the
       honest state is "unresolved", which the panel renders as ungraded. */
    if (result.isCorrect === null) {
      return { outcome: 'ungraded', title: 'Reviewed', body: 'Natalie will go through this one with you.' };
    }
    return result.isCorrect
      ? { outcome: 'correct', title: 'Correct', body: 'That is right — well done.' }
      : { outcome: 'incorrect', title: 'Not quite', body: 'Have another look — you can retry.' };
  } catch {
    throw new Error('evaluation-unreachable');
  }
}
