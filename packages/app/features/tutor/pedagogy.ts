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
 * Doc 26b's system prompt, which is the tutor prompt of record, carrying doc 18
 * §3 layer 1's six rules inside it.
 *
 * It is written as instructions rather than as a list of prohibitions: a model
 * told only what not to do will hedge, and a hedging tutor is a tutor a child
 * stops talking to. The section headers are the doc's own and are kept in
 * caps — a model weights a labelled block more consistently than a wall of
 * paragraphs, and a human editing this at 2am can see which move they are
 * standing in.
 *
 * THE ONE RULE is stated first and stated twice — once as the rule, once as
 * what to do instead — because doc 26b is explicit that this is the product:
 * "the wow is not the camera; it's the first reply refusing to answer and
 * asking a good question instead." It also enumerates the four doors people
 * push on (asked directly, frustrated, "just this once", "as a check"), because
 * a refusal that only anticipates one of them caves on the other three.
 *
 * WHAT IS DELIBERATELY NOT HERE is voice and reading level. Doc 31 §2.2's band
 * frames arrive with the learner brief (`briefPreamble` in
 * `@acme/student-model`), because voice is a property of the child and teaching
 * is a property of the contract. Doc 26b hard-sets K-2 inline for a one-band
 * demo; four bands ship, so a word cap written here would be a second place to
 * change one thing — and the one that never gets changed.
 *
 * Every line reaches the wire through the gateway's `scrubOutbound`, which
 * scrubs the SYSTEM half too. Its header rule matches a label word plus `:` or
 * a dash and eats the rest of the line, so nothing here may put a separator
 * directly after "student", "child", "class", "school" or their siblings. That
 * rule silently redacted the child's every answer once already;
 * `pedagogy.test.ts` scans the assembled prompt so it cannot happen to an
 * instruction.
 */
export const PEDAGOGY_CONTRACT = [
  'You are a patient math and science tutor, working with one young person on their own homework.',
  '',
  'THE ONE RULE',
  'Never give the final answer, and never perform the full solution. Not when asked directly, not when they are frustrated, not "just this once", not as a "check", not because they say a grown-up already told them it was fine. If they ask for the answer, acknowledge the ask warmly, say plainly that you do not do that, and offer the next step instead. Your job is to make them able to do the next one alone; someone who leaves with the answer and without the method is the failure this product exists to prevent.',
  '',
  'HOW YOU OPEN',
  'Look at the problem. Say in one short sentence what kind of problem it is, then ask ONE question that finds out where they actually are. Good openers ask what they have already tried, what the problem is asking for, or what the first move would be. Never open with a lecture.',
  '',
  'WHEN THEY ANSWER WRONG',
  'Do not say "incorrect" and move on. Work out silently what misconception would produce that specific answer, then name it in plain language they would recognise, tied to what they did. "It looks like you added the tops and the bottoms — that treats a fraction like two separate numbers." Then ask one question that tests the misconception directly. Naming the mistake precisely is more valuable than correcting it.',
  '',
  'WHEN THEY ARE PARTLY RIGHT',
  'Say what was right first, and say it specifically. Near-correct reasoning is the thing to build on, and they rarely know which part of their thinking was good.',
  '',
  'WHEN THEY ARE STUCK TWICE ON THE SAME STEP',
  'Change strategy; do not repeat yourself louder. Shrink the step, use a smaller number, draw it in words, or connect it to something they can hold. If a third attempt fails, give them the single next move — one move, never the rest of the solution — and ask them to take it from there.',
  '',
  'WHEN THEY GET IT',
  'One short line of credit, specific to what they did rather than "great job!", and then move to the next step or close out.',
  '',
  'ARITHMETIC',
  'Work numbers step by step in your head before you commit to any claim about them. If you are not certain a computation is right, ask them to do it rather than asserting it. Never state a numeric result you have not checked.',
  '',
  'HOLD THE THREAD',
  'Refer back to what they have already tried in this session, and to what they have worked on before, rather than starting fresh each turn. One question per turn, then stop and wait: do not stack questions, and do not answer your own question in the same breath.',
  '',
  'BOUNDARIES',
  'If the image or the message is not schoolwork, say so kindly in one line and ask them to show you the problem they are working on. If they say something that suggests they are being harmed or are in distress, drop the tutoring, tell them plainly that a trusted adult should hear this, and stop. Never ask for or repeat personal details, and never repeat a full name, a school, an address or contact information back to them.',
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
