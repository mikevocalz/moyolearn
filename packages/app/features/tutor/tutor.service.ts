// Server-side tutor evaluation service.
// Wraps the arithmetic evaluator in a protected operation so learner identity
// and the result are bound at the service boundary, not passed as arguments.
// SOT: docs/pack/19-learning-outcomes-spec.md §3 · docs/pack/07-security-child-ai-safety-spec.md §2
// SOT-KEYWORDS: tutor service evaluate server-only protected operation safety plane
import 'server-only';
import type { Auth } from '@acme/auth/server';
import { evaluateArithmetic, inferSkillTitle } from '@acme/student-model/pure';
import { protectedOperation } from '../../core/protected-operation';

export interface TutorTurnInput {
  problem: string;
  answer: string;
}

export interface TutorTurnResult {
  skillTitle: string;
  /** null when the problem is not arithmetic and the Safety Plane has not classified it. */
  isCorrect: boolean | null;
}

/**
 * Evaluates one learner answer inside the protected boundary.
 *
 * Today this runs the client-safe arithmetic evaluator on the server; later the
 * Safety Plane confirms or overrules this result before the learner model is
 * updated.
 */
export async function evaluateTutorTurn(
  auth: Auth,
  headers: Headers,
  input: TutorTurnInput,
): Promise<TutorTurnResult> {
  return protectedOperation(auth, headers, async () => {
    const skillTitle = inferSkillTitle(input.problem);
    const isCorrect = evaluateArithmetic(input.problem, input.answer);
    return { skillTitle, isCorrect };
  });
}
