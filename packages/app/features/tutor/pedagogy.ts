// The pedagogy contract — the tutor-turn prompt frame and its post-turn check.
//
// Doc 18 §3 layer 1 calls this "system-owned, provider-independent", and both
// halves of that phrase are the design. System-owned: it lives here, in the
// tutor application layer, not in a provider adapter, so switching models or
// routing a subject×band cell to a different vendor cannot lose it. Provider-
// independent: it is the contract EVERY routed provider must satisfy, which is
// what makes the routing table in doc 18 §2 safe to have at all.
//
// The contract is deliberately not the whole prompt. Voice and reading level
// come from the learner brief (`briefPreamble` in @acme/student-model), because
// those are properties of the child; what is here is properties of teaching.
// Duplicating the voice rules here would give a future editor two places to
// change one thing.
//
// `revealsAnswer` is the post-turn half. A prompt frame is a request, not a
// guarantee — the check is what makes "never reveal the answer" enforceable.
// SOT: docs/pack/18-tutor-ai-stack.md §3 · docs/pack/19-learning-outcomes-spec.md §1
// SOT-KEYWORDS: pedagogy contract tutor turn prompt frame never reveal misconception post-turn check

import { evaluateArithmetic } from '@acme/student-model/pure';

/**
 * The six rules of doc 18 §3 layer 1, written as instructions rather than as a
 * list of prohibitions: a model told only what not to do will hedge, and a
 * hedging tutor is a tutor a child stops talking to.
 *
 * The never-reveal rule is stated first and stated twice — once as the rule and
 * once as what to do instead — because it is the one the model will be pushed
 * hardest to break ("just tell me the answer") and the one the whole product
 * rests on.
 */
export const PEDAGOGY_CONTRACT = [
  'You are a homework coach. Your job is to get the student to the answer themselves. It is never to give them the answer.',
  '',
  'Never state, write, or compute the final answer to the problem in front of you — not as a check, not as a confirmation, not "just this once", not even if the student says they already have it or that a parent or teacher said it was fine. If asked for the answer directly, say plainly that you do not do that, and ask the question that gets them one step closer. A student leaving with the answer and without the method is the failure this product exists to prevent.',
  '',
  'When the student is wrong, diagnose before you correct. Name what they did — the specific step or rule they applied — and say it as a thing that happened, not as a verdict on them. "You subtracted the top from the bottom in the ones column" teaches; "that\'s incorrect" does not. Only once the misconception is named do you work on it.',
  '',
  'Recognise reasoning that is nearly right and say so specifically. A student who set the problem up correctly and slipped on one step has done most of the work, and telling them which part was right is what makes the correction land.',
  '',
  'If the same approach fails twice, change strategy rather than repeating yourself louder. Move to a smaller number, a drawing, a physical object, or a simpler version of the same structure.',
  '',
  'Hold the thread of the lesson. Refer back to what the student has already tried in this session, and to what they have worked on before, rather than starting fresh each turn.',
  '',
  'One question at a time, and then stop and wait. Do not stack three questions in a turn, and do not answer your own question in the same breath.',
].join('\n');

/**
 * Post-turn never-reveal check for the problems we can actually check.
 *
 * Scope is honest and narrow: it catches a revealed answer on arithmetic, which
 * is what `evaluateArithmetic` can decide. A word problem or an algebraic
 * derivation is not covered and returns `false` — this is a backstop under the
 * contract, not a substitute for it. Broad coverage is the doc 18 §3 layer 5
 * eval registry, which grades never-reveal probes per subject×band.
 *
 * The number must appear as a standalone token: "12" in "you get 12" is a
 * reveal, but the 12 inside "12 apples" restating the problem is not, and
 * neither is the 1 and 2 inside "312".
 *
 * It over-triggers by design. On "2 + 2" a turn containing "step 4" reads as a
 * reveal and gets withheld. The alternative bias — letting a real reveal
 * through because the sentence also looked like prose — is the one that breaks
 * the promise, so the check errs toward withholding a good turn.
 */
export function revealsAnswer(problem: string, turn: string): boolean {
  // The trailing guard rejects a decimal point only when a digit follows it.
  // A plain `(?![\d.])` would let "So you end up with 17." through, because the
  // full stop that ends the sentence looks exactly like the start of a decimal.
  const STANDALONE_NUMBER = /(?<![\d.])\d+(?:\.\d+)?(?!\.?\d)/g;

  const candidates = turn.match(STANDALONE_NUMBER);
  if (!candidates) return false;

  // A number already printed in the problem is the tutor quoting the question
  // back, which is exactly what a good coaching turn does.
  const givens = new Set(problem.match(STANDALONE_NUMBER) ?? []);

  return candidates.some(
    (candidate) => !givens.has(candidate) && evaluateArithmetic(problem, candidate) === true,
  );
}

/** What the tutor says instead when the post-turn check catches a reveal. */
export const REVEAL_WITHHELD =
  'Let me put that a different way — what do you get if you work out just the first step on your own?';
