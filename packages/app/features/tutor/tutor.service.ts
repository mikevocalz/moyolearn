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
import { distill, withoutBlockedTags } from '@acme/student-model';
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
 * Tags a guardian has erased, which distillation must not re-derive.
 *
 * `withoutBlockedTags` has existed in `@acme/student-model` since the erasure
 * cascade was written, is exported, and is covered by two tests — and had NO
 * production call site. So erasure worked exactly once: a guardian deleted the
 * interest, and the next session read the same turns and derived it again. The
 * cascade was correct and the loop around it put the fact straight back.
 *
 * A port rather than a direct read, like every other store this service
 * touches, so the filter is on the distillation path structurally instead of
 * being something a future caller can forget.
 */
export type LoadBlockedTags = (ctx: ProtectedCtx) => Promise<readonly string[]>;

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
  loadBlockedTags?: LoadBlockedTags,
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
      /*
        FILTERED BEFORE DISTILLATION, not after.

        Filtering the OUTPUT facts would still let a blocked tag influence what
        else is derived from the same turn, and would re-derive it the moment
        anyone added a second consumer. Stripping the tags from the turns means
        the erased thing is not in the input at all, which is the only version of
        this that stays true when the distiller changes.
      */
      const blockedTags = loadBlockedTags ? await loadBlockedTags(ctx) : [];
      const nextFacts = distill(
        { ...transcript, turns: withoutBlockedTags(transcript.turns, blockedTags) },
        priorFacts,
        now,
      );
      await saveFacts(ctx, nextFacts);
    }

    return { skillTitle, isCorrect };
  });
}
