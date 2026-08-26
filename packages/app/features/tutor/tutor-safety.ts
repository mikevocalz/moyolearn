// Tutor-side Safety Plane adapter (doc 07 §3).
//
// The full `packages/safety` plane is conversational; this adapter turns the
// arithmetic tutor's problem/answer exchange into the same `PlaneResult` shape.
// A problem that `evaluateArithmetic` can parse is on-task and storable;
// anything else is off-task and not written to the student model.
// SOT: docs/pack/07-security-child-ai-safety-spec.md §3
// SOT-KEYWORDS: tutor safety plane arithmetic off-task storable classify generator
import 'server-only';
import { evaluateArithmetic } from '@acme/student-model/pure';
import {
  runSafetyPlane,
  type Classifier,
  type Generator,
  type IdentityContext,
  type InputClass,
  type PlaneResult,
} from '@acme/safety';
import type { ProtectedCtx } from '../../core/protected-operation';

function classifyProblem(problem: string, answer: string): InputClass {
  const isArithmetic = evaluateArithmetic(problem, answer) !== null;
  return isArithmetic ? 'safe' : 'off-task';
}

const tutorClassifier: Classifier = {
  classifyInput: async (message: string, _context: IdentityContext): Promise<InputClass> =>
    classifyProblem(message, '0'),
  classifyOutput: async (_text: string, _context: IdentityContext): Promise<InputClass[]> =>
    [],
};

const tutorGenerator: Generator = {
  generate: async (message: string, _context: IdentityContext): Promise<string> =>
    `Solve: ${message}`,
};

export async function runTutorSafetyPlane(
  problem: string,
  ctx: ProtectedCtx,
): Promise<PlaneResult> {
  const identity: IdentityContext = {
    learnerId: ctx.learnerId,
    gradeBand: 'older',
    isMinor: true,
    aiEnabled: true,
  };
  return runSafetyPlane(problem, identity, { classifier: tutorClassifier, generator: tutorGenerator });
}
