// Server-side tutor evaluation service.
// Wraps the arithmetic evaluator in a protected operation so learner identity
// and the result are bound at the service boundary, not passed as arguments.
// SOT: docs/pack/19-learning-outcomes-spec.md §3 · docs/pack/07-security-child-ai-safety-spec.md §3
// SOT-KEYWORDS: tutor service evaluate server-only protected operation safety plane transcript distill
import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import type { Auth } from '@acme/auth/server';
import {
  evaluateArithmetic,
  inferSkillTitle,
} from '@acme/student-model/pure';
import { transcriptExpiry } from '@acme/student-model';
import type { SessionTurn, DerivedFact } from '@acme/student-model';
import { protectedOperation, type ProtectedCtx } from '../../core/protected-operation.ts';
import { runTutorSafetyPlane } from './tutor-safety.ts';
import type { AssessmentReadiness } from '../capture/assessment-readiness.ts';

export interface TutorTurnInput {
  problem: string;
  answer: string;
  /** How far down the Socratic hint ladder the learner went before answering. */
  hintDepth: number;
  sourceReadiness?: AssessmentReadiness;
  evidence?: { questionId: string; revision: string };
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
  evidence: { questionId: string; revision: string };
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
 * Everything distillation needs, as ONE argument — which is the fix, not the
 * tidying.
 *
 * These were three independent optional parameters and the middle of the three
 * was optional in the worst possible way: `loadBlockedTags ? await … : []` meant
 * a caller who supplied the other two got distillation with the erasure filter
 * silently disabled, and every caller did exactly that. Declaring the port and
 * defaulting it to "no tags are blocked" made forgetting it invisible.
 *
 * Grouped, it is unrepresentable. There is no way to distil without saying where
 * a guardian's erasures are read from, because the type that turns distillation
 * on is the type that carries the reader. CLAUDE.md §Types: invalid combinations
 * must be unrepresentable, not merely unusual.
 */
export interface DistillationPorts {
  readonly loadPriorFacts: LoadPriorFacts;
  readonly saveFacts: SaveFacts;
  readonly loadBlockedTags: LoadBlockedTags;
}

/**
 * The repositories this service acts through.
 *
 * `distillation` is absent on the tutoring request path on purpose — doc 12 §5
 * puts distillation "async after close" and `app/api/tutor/evaluate` enqueues
 * `edu.distill` instead (see that route's header). Absent means "not here",
 * which is a decision; it no longer means "here, unfiltered".
 */
export interface TutorTurnPorts {
  readonly saveTranscript?: SaveTranscript;
  readonly distillation?: DistillationPorts;
  /**
   * Must lock the owned current revision for the entire callback and commit its
   * transcript in that transaction. Missing/deleted/stale evidence returns null.
   * The legacy HTTP route has no such repository yet and therefore cannot grade.
   */
  readonly withCurrentEvidence?: (
    ctx: ProtectedCtx,
    reference: NonNullable<TutorTurnInput['evidence']>,
    assess: (evidence: AssessmentEvidence, save: SaveTranscript) => Promise<TutorTurnResult>,
  ) => Promise<TutorTurnResult | null>;
}

export interface AssessmentEvidence {
  readonly questionId: string;
  readonly revision: string;
  readonly learnerId: string;
  readonly orgId: string | null;
  /**
   * `problemDigest(problem)` of the text the server issued — not the text.
   *
   * The educational store may not hold raw text (doc 12 §4, enforced by the
   * standing assertion at the foot of `edu_schema.sql`), and a question a child
   * is graded against is exactly the kind of string that assertion exists to
   * keep out. A digest answers the only question this service asks of it —
   * "is this the problem you were issued" — and answers it just as strictly,
   * because a learner who edits one character cannot produce the same 64 hex
   * characters.
   */
  readonly problemDigest: string;
  readonly evaluationReady: boolean;
  readonly expiresAt: string;
}

/**
 * The binding between an issued question and the text a turn claims to answer.
 *
 * SHA-256 rather than a comparison of the strings themselves so the store can
 * hold the binding without holding the child's homework. Hex, so the value fits
 * `edu.opaque_id` and is therefore constrained by the schema rather than by
 * this function alone.
 */
export function problemDigest(problem: string): string {
  return createHash('sha256').update(problem, 'utf8').digest('hex');
}

/**
 * Evaluates only inside a repository-held current evidence revision. Inline
 * distillation is refused: downstream jobs also need revision validation.
 */
export async function evaluateTutorTurn(
  auth: Auth,
  headers: Headers,
  input: TutorTurnInput,
  ports: TutorTurnPorts = {},
): Promise<TutorTurnResult> {
  return protectedOperation(auth, headers, async (ctx) => {
    const skillTitle = inferSkillTitle(input.problem);
    const unresolved: TutorTurnResult = { skillTitle, isCorrect: null };
    // A client saying "verified" is not authorization to grade. Only an owned,
    // current server revision held through the write can authorize assessment.
    if (!input.evidence || !ports.withCurrentEvidence || ports.distillation ||
        !/^[A-Za-z0-9._:-]{1,128}$/.test(input.evidence.questionId) ||
        !/^[A-Za-z0-9._:-]{1,128}$/.test(input.evidence.revision)) return unresolved;
    return await ports.withCurrentEvidence(ctx, input.evidence, async (evidence, saveTranscript) => {
      if (!evidence.evaluationReady || evidence.learnerId !== ctx.learnerId ||
          evidence.orgId !== (ctx.orgId ?? null) || evidence.questionId !== input.evidence?.questionId ||
          evidence.revision !== input.evidence.revision ||
          evidence.problemDigest !== problemDigest(input.problem) ||
          !Number.isFinite(Date.parse(evidence.expiresAt)) || Date.parse(evidence.expiresAt) <= Date.now()) return unresolved;
      const safety = await runTutorSafetyPlane(input.problem, ctx);

      if (!safety.outcome.storeInStudentModel) return unresolved;

      const isCorrect = evaluateArithmetic(input.problem, input.answer);
      if (isCorrect === null) return unresolved;

      const turn: SessionTurn = {
        skillId: skillTitle,
        skillTitle,
        correct: isCorrect,
        hintDepth: input.hintDepth,
        storable: true,
      };

      const now = new Date();
      const sessionId = randomUUID();
      const transcriptToSave: TranscriptToSave = {
        sessionId,
        learnerAuthId: ctx.learnerId,
        turns: [turn],
        capturedAt: now.toISOString(),
        expiresAt: transcriptExpiry(now),
        evidence: { questionId: evidence.questionId, revision: evidence.revision },
      };

      await saveTranscript(ctx, transcriptToSave);

      return { skillTitle, isCorrect };
    }) ?? unresolved;
  });
}
