// Server-side tutor evaluation service.
// Wraps the arithmetic evaluator in a protected operation so learner identity
// and the result are bound at the service boundary, not passed as arguments.
// SOT: docs/pack/19-learning-outcomes-spec.md §3 · docs/pack/07-security-child-ai-safety-spec.md §3
// SOT-KEYWORDS: tutor service evaluate server-only protected operation safety plane transcript distill
import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Auth } from '@acme/auth/server';
import {
  evaluateArithmetic,
  inferSkillTitle,
} from '@acme/student-model/pure';
import { transcriptExpiry } from '@acme/student-model';
import type { SessionTurn, SessionTranscript, DerivedFact } from '@acme/student-model';
import { distill } from '@acme/student-model';
import { protectedOperation, type ProtectedCtx } from '../../core/protected-operation';
import { runTutorSafetyPlane } from './tutor-safety';

export interface TutorTurnInput {
  problem: string;
  answer: string;
  /** How far down the Socratic hint ladder the learner went before answering. */
  hintDepth: number;
}

export interface TutorTurnResult {
  skillTitle: string;
  /** null when the Safety Plane blocked or could not classify the problem. */
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

/** Repository ports — the caller provides the Payload adapters. */
export type LoadPriorFacts = (ctx: ProtectedCtx) => Promise<readonly DerivedFact[]>;
export type SaveTranscript = (ctx: ProtectedCtx, transcript: TranscriptToSave) => Promise<void>;
export type SaveFacts = (ctx: ProtectedCtx, facts: readonly DerivedFact[]) => Promise<void>;

/**
 * Evaluates one learner answer inside the protected boundary, runs the Safety
 * Plane, persists the transcript, distills the updated student model, and writes
 * the derived facts back.
 */
export async function evaluateTutorTurn(
  auth: Auth,
  headers: Headers,
  input: TutorTurnInput,
  loadPriorFacts?: LoadPriorFacts,
  saveTranscript?: SaveTranscript,
  saveFacts?: SaveFacts,
): Promise<TutorTurnResult> {
  return protectedOperation(auth, headers, async (ctx) => {
    const skillTitle = inferSkillTitle(input.problem);
    const safety = await runTutorSafetyPlane(input.problem, ctx);

    if (!safety.outcome.storeInStudentModel) {
      const turn: SessionTurn = {
        skillId: skillTitle,
        skillTitle,
        correct: false,
        hintDepth: input.hintDepth,
        storable: false,
      };
      const now = new Date();
      const sessionId = randomUUID();
      const transcriptToSave: TranscriptToSave = {
        sessionId,
        learnerAuthId: ctx.learnerId,
        turns: [turn],
        capturedAt: now.toISOString(),
        expiresAt: transcriptExpiry(now),
      };
      if (saveTranscript) {
        await saveTranscript(ctx, transcriptToSave);
      }
      return { skillTitle, isCorrect: null };
    }

    const isCorrect = evaluateArithmetic(input.problem, input.answer);

    const turn: SessionTurn = {
      skillId: skillTitle,
      skillTitle,
      correct: isCorrect ?? false,
      hintDepth: input.hintDepth,
      storable: isCorrect !== null,
    };

    const now = new Date();
    const sessionId = randomUUID();
    const transcriptToSave: TranscriptToSave = {
      sessionId,
      learnerAuthId: ctx.learnerId,
      turns: [turn],
      capturedAt: now.toISOString(),
      expiresAt: transcriptExpiry(now),
    };

    if (saveTranscript) {
      await saveTranscript(ctx, transcriptToSave);
    }

    if (loadPriorFacts && saveFacts) {
      const priorFacts = await loadPriorFacts(ctx);
      const transcript: SessionTranscript = {
        id: sessionId,
        learnerId: ctx.learnerId,
        capturedAt: transcriptToSave.capturedAt,
        expiresAt: transcriptToSave.expiresAt,
        turns: transcriptToSave.turns,
      };
      const nextFacts = distill(transcript, priorFacts, now);
      await saveFacts(ctx, nextFacts);
    }

    return { skillTitle, isCorrect };
  });
}
