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
 */
const CRISIS_PATTERNS: RegExp[] = [
  /\b(kill|hurt|harm|cut)(ing)?\s+(my ?self|me)\b/i,
  /\b(want|going|plan|planning|trying)\s+to\s+(die|end\s+it|not\s+be\s+here)\b/i,
  /\b(suicid|self[\s-]?harm)/i,
  /\bdon'?t\s+want\s+to\s+(live|be\s+alive|be\s+here)\b/i,
  /\bwish\s+i\s+(was|were)\s+dead\b/i,
  /\b(someone|he|she|they|my\s+\w+)\s+(is\s+)?(hurt|hurting|touch|touching|hitting|beat|beating)\s+me\b/i,
  /\bi'?m\s+(not\s+)?safe\b/i,
  /\bafraid\s+to\s+go\s+home\b/i,
];

const SENSITIVE_PATTERNS: RegExp[] = [
  /\b(bull(y|ied|ying)|picked\s+on|made\s+fun\s+of)\b/i,
  /\bno\s+(one|body)\s+likes\s+me\b/i,
  /\bi'?m\s+(so\s+)?(sad|depressed|worthless|stupid|a\s+failure)\b/i,
  /\bi\s+hate\s+my\s?self\b/i,
  /\b(my\s+)?(parents|mom|dad)\s+(are\s+)?(fighting|divorc|yell)/i,
  /\b(scared|anxious|terrified)\s+(about|of)\b/i,
  /\bcan'?t\s+stop\s+crying\b/i,
];

const PROHIBITED_PATTERNS: RegExp[] = [
  /\b(sex|sexual|porn|nude|naked)\b/i,
  /\bhow\s+(do|to)\s+i?\s*(make|build)\s+a?\s*(bomb|weapon|gun|poison)\b/i,
  /\b(buy|get|score)\s+(drugs|weed|pills|alcohol)\b/i,
];

const matches = (patterns: RegExp[], text: string): boolean =>
  patterns.some((pattern) => pattern.test(text));

/**
 * Ordered so the most serious class wins a message that reads as several. A
 * disclosure that also mentions self-harm is a crisis, not a sensitive turn.
 */
function classifyCoachInput(message: string): InputClass {
  if (matches(CRISIS_PATTERNS, message)) return 'crisis';
  if (matches(PROHIBITED_PATTERNS, message)) return 'prohibited';
  if (matches(SENSITIVE_PATTERNS, message)) return 'sensitive';
  return 'safe';
}

/**
 * The same patterns applied to what the tutor produced. A model that echoes a
 * child's disclosure back at them has turned a handoff into a conversation,
 * which doc 07 §3 layer 3 is explicit it must never do.
 */
export const coachClassifier: Classifier = {
  classifyInput: async (message: string, _context: IdentityContext): Promise<InputClass> =>
    classifyCoachInput(message),
  classifyOutput: async (text: string, _context: IdentityContext): Promise<InputClass[]> => {
    const classes: InputClass[] = [];
    if (matches(CRISIS_PATTERNS, text)) classes.push('crisis');
    if (matches(PROHIBITED_PATTERNS, text)) classes.push('prohibited');
    return classes;
  },
};

/** Doc 07 §3 layer 1: the band is server-derived, never client-supplied. */
export function coachIdentity(ctx: ProtectedCtx, gradeBand: IdentityContext['gradeBand']): IdentityContext {
  return {
    learnerId: ctx.learnerId,
    gradeBand,
    isMinor: ctx.isLearner,
    aiEnabled: true,
  };
}
