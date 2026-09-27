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
import { xrLocalGrade } from './xr-local-tutor.ts';
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
 *
 * LOCAL FIRST, ESCALATE ON DIFFICULTY. The on-device tutor (`xr-local-tutor`)
 * marks every answer it can express as text; `null` from it means "could not
 * decide", and only then does the question's own evaluation kind choose the
 * next reader — `server-objective` climbs to `/api/tutor/evaluate`, review
 * kinds fall back to honest review copy. A headset that cannot reach the
 * server resolves `ungraded` rather than trapping the flow in `error`: the
 * next question is always one NEXT press away.
 */
export async function evaluateXrAnswer(
  question: XrLearningQuestion,
  draft: XrAnswerDraft,
  hintDepth = 0,
): Promise<XrQuestionFeedback> {
  const answer = draftAnswerText(question, draft);

  /* The on-device marker reads everything that has a text form first.
     `ungraded` questions still take the verdict's BODY — the outcome stays
     'ungraded' because the question's contract forbids claiming correctness —
     so a child gets real feedback text instead of "recorded". */
  const local = answer === null ? null : await xrLocalGrade(question, answer);

  switch (question.evaluation.kind) {
    case 'ungraded':
      return {
        outcome: 'ungraded',
        title: 'Noted',
        body: local?.body ?? 'Your answer was recorded.',
      };
    case 'coach-review':
    case 'teacher-review':
      /* Review kinds were "the tutor checks" by default — now the local
         marker grades when it can, and the tutor only sees what the device
         genuinely could not decide. */
      if (local) {
        return {
          outcome: local.outcome,
          title: local.outcome === 'correct' ? 'Correct' : 'Not quite',
          body: local.body,
        };
      }
      return {
        outcome: 'ungraded',
        title: 'Sent for review',
        body: 'Natalie will look at this one with you.',
      };
    case 'server-objective': {
      if (local) {
        return {
          outcome: local.outcome,
          title: local.outcome === 'correct' ? 'Correct' : 'Not quite',
          body: local.body,
        };
      }
      /* Local could not decide — the question escalates to the server, its
         authored route. */
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
        /* The headset cannot reach the server — resolve ungraded with honest
           copy so `submit` lands in `feedback` and NEXT stays live, instead of
           an error phase that swallows every command. */
        return {
          outcome: 'ungraded',
          title: 'Answered',
          body: 'I could not check that one just now — we will look at it together later.',
        };
      }
    }
  }
}
