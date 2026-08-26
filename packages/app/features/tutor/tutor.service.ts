// Server-side tutor evaluation service.
// Wraps the arithmetic evaluator in a protected operation so learner identity
// and the result are bound at the service boundary, not passed as arguments.
// SOT: docs/pack/19-learning-outcomes-spec.md §3 · docs/pack/07-security-child-ai-safety-spec.md §2
// SOT-KEYWORDS: tutor service evaluate server-only protected operation safety plane transcript
import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Auth } from '@acme/auth/server';
import {
  evaluateArithmetic,
  inferSkillTitle,
} from '@acme/student-model/pure';
import { transcriptExpiry } from '@acme/student-model';
import type { SessionTurn } from '@acme/student-model';
import { protectedOperation, type ProtectedCtx } from '../../core/protected-operation';

export interface TutorTurnInput {
  problem: string;
  answer: string;
  /** How far down the Socratic hint ladder the learner went before answering. */
  hintDepth: number;
}

export interface TutorTurnResult {
  skillTitle: string;
  /** null when the problem is not arithmetic and the Safety Plane has not classified it. */
  isCorrect: boolean | null;
}

/** Shape the service hands to a repository for persistence. */
export interface TranscriptToSave {
  sessionId: string;
  learnerAuthId: string;
  turns: readonly SessionTurn[];
  capturedAt: string;
  expiresAt: string;
}

/** Repository port — the caller provides the Payload adapter. */
export type SaveTranscript = (ctx: ProtectedCtx, transcript: TranscriptToSave) => Promise<void>;

/**
 * Evaluates one learner answer inside the protected boundary and optionally
 * persists the transcript.
 *
 * Today this runs the client-safe arithmetic evaluator on the server; later the
 * Safety Plane confirms or overrules this result before the learner model is
 * updated.
 */
export async function evaluateTutorTurn(
  auth: Auth,
  headers: Headers,
  input: TutorTurnInput,
  saveTranscript?: SaveTranscript,
): Promise<TutorTurnResult> {
  return protectedOperation(auth, headers, async (ctx) => {
    const skillTitle = inferSkillTitle(input.problem);
    const isCorrect = evaluateArithmetic(input.problem, input.answer);

    if (saveTranscript) {
      const turn: SessionTurn = {
        skillId: skillTitle,
        skillTitle,
        correct: isCorrect ?? false,
        hintDepth: input.hintDepth,
        storable: isCorrect !== null,
      };
      const now = new Date();
      await saveTranscript(ctx, {
        sessionId: randomUUID(),
        learnerAuthId: ctx.learnerId,
        turns: [turn],
        capturedAt: now.toISOString(),
        expiresAt: transcriptExpiry(now),
      });
    }

    return { skillTitle, isCorrect };
  });
}
