// Tutor-side Safety Plane adapter (doc 07 §3).
//
// The full `packages/safety` plane is conversational; this adapter turns the
// arithmetic tutor's problem/answer exchange into the same `PlaneResult` shape.
// A problem that `evaluateArithmetic` can parse is on-task and storable;
// anything else is off-task and not written to the student model.
// SOT: docs/pack/07-security-child-ai-safety-spec.md §3
// SOT-KEYWORDS: tutor safety plane arithmetic off-task storable classify generator coach crisis sensitive
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
import type { LearnerFlags } from '@acme/auth/server';
import type { ProtectedCtx } from '../../core/protected-operation';
import {
  CRISIS_PATTERNS,
  PROHIBITED_PATTERNS,
  classifyCoachInput,
  matchesAny,
} from './coach-safety-patterns.ts';

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

/**
 * The answer-check path does not consult the guardian's AI switch, and that is a
 * decision rather than the leftover literal it looks like.
 *
 * `IdentityContext.aiEnabled` gates the plane's `refused` branch, which exists
 * so a guardian can turn AI TUTORING off. Nothing on this path is AI: the
 * generator below is a string template and the verdict comes from
 * `evaluateArithmetic`. Wiring the flag in here would mean a parent who switched
 * the tutor off also switched off marking `12 + 5`, which is not what the switch
 * says and is not what they chose.
 *
 * The coaching turn — the one that reaches a model — reads the real flag; see
 * `coachIdentity` below.
 */
const ANSWER_CHECK_IS_NOT_AI = true;

export async function runTutorSafetyPlane(
  problem: string,
  ctx: ProtectedCtx,
): Promise<PlaneResult> {
  const identity: IdentityContext = {
    learnerId: ctx.learnerId,
    gradeBand: 'older',
    isMinor: true,
    aiEnabled: ANSWER_CHECK_IS_NOT_AI,
  };
  return runSafetyPlane(problem, identity, { classifier: tutorClassifier, generator: tutorGenerator });
}

/**
 * The coaching turn's classifier (doc 07 §3 layer 3).
 *
 * The arithmetic classifier above cannot serve a coaching turn: it calls
 * anything `evaluateArithmetic` cannot parse `off-task`, and a photographed
 * word problem — "Sarah has 3 apples and gives away 1" — is exactly that. On
 * the capture flow it would fence off the entire product.
 *
 * So this one is a deterministic floor rather than a topic fence: it routes the
 * classes where being wrong is unacceptable (crisis, then disclosure) and lets
 * everything else through as schoolwork. Topic drift is handled downstream —
 * the two-directional firewall screens the child's words for the §2.3 patterns,
 * and the pedagogy contract keeps the model on the work.
 *
 * It is a floor, and the ceiling is named: doc 18 §3 layer 5's eval registry
 * (PR-50) is where a model-backed classifier lands, graded per subject×band.
 * Until then these patterns are what stands between a disclosure and a tutor
 * turn, which is why they are broad and why they fail toward stopping.
 * The patterns themselves live in `coach-safety-patterns.ts`, shared with the
 * on-device tutor so a locally generated turn is held to the same floor.
 *
 * OUTPUT GETS THE SAME FLOOR. A model that echoes a child's disclosure back at
 * them has turned a handoff into a conversation, which doc 07 §3 layer 3 is
 * explicit it must never do.
 */
export const coachClassifier: Classifier = {
  classifyInput: async (message: string, _context: IdentityContext): Promise<InputClass> =>
    classifyCoachInput(message),
  classifyOutput: async (text: string, _context: IdentityContext): Promise<InputClass[]> => {
    const classes: InputClass[] = [];
    if (matchesAny(CRISIS_PATTERNS, text)) classes.push('crisis');
    if (matchesAny(PROHIBITED_PATTERNS, text)) classes.push('prohibited');
    return classes;
  },
};

/**
 * Doc 07 §3 layer 1: every field here is server-derived, never client-supplied.
 *
 * `aiEnabled` used to be the literal `true`, which made the plane's `refused`
 * branch unreachable in production — a guardian could not have turned AI
 * tutoring off if they had wanted to, because nothing read the switch. It now
 * comes from `learnerFields` in `@acme/auth`, resolved by the boundary inside
 * `safetyLayer('1-identity')` alongside the band: guardian policy IS layer 1, so
 * a policy the server cannot resolve is a layer that is down rather than a
 * default to fall back on.
 */
export function coachIdentity(
  ctx: ProtectedCtx,
  gradeBand: IdentityContext['gradeBand'],
  flags: LearnerFlags,
): IdentityContext {
  return {
    learnerId: ctx.learnerId,
    gradeBand,
    isMinor: ctx.isLearner,
    aiEnabled: flags.aiEnabled,
  };
}
