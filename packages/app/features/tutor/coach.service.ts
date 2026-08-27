// The coaching turn — the money shot of the homework loop (doc 29 §3).
//
// A captured problem plus whatever the student just said goes in; a stream of
// coaching text comes out, and the answer never does. Everything that makes
// that true is composition rather than discipline: the vendor call is a
// `ModelStreamCall`, which only `withLearnerBriefStream` accepts, which returns
// a `StreamingGenerator`, which only `runSafetyPlaneStream` accepts. There is
// no argument order that gets a model in front of a child with the plane
// skipped, so this file has nothing to remember.
//
// It returns a generator rather than taking a callback so the transport owns
// framing: the same stream serves SSE on web and whatever native uses later,
// and neither one gets to see a chunk the plane has not passed.
// SOT: docs/pack/18-tutor-ai-stack.md §3 · docs/pack/29-shipaton-plan.md §3 · docs/pack/12-systems-design-prompt.md §5 · CLAUDE.md §The block
// SOT-KEYWORDS: coach service tutor turn stream protected operation safety plane pedagogy contract fail closed unavailable paused
import 'server-only';
import type { Auth } from '@acme/auth/server';
import { runSafetyPlaneStream, safetyLayer, SafetyLayerUnavailable } from '@acme/safety';
import { compileLearnerBrief, withLearnerBriefStream } from '@acme/student-model';
import { protectedOperation, type ProtectedCtx } from '../../core/protected-operation.ts';
import { coachClassifier, coachIdentity } from './tutor-safety.ts';
import { streamTutorTurn } from './tutor-model.ts';
import { PEDAGOGY_CONTRACT, REVEAL_WITHHELD, revealsAnswer } from './pedagogy.ts';
import type { LoadPriorFacts } from './tutor.service';

export interface CoachTurnInput {
  /** The captured or served problem the session is working on. */
  problem: string;
  /** What the student just said. Empty on the opening turn. */
  message: string;
}

/**
 * The wire contract. `replace` and `blocked` both mean "discard what you have
 * already rendered" — a plane outcome that arrives after a chunk is a retraction
 * (doc 07 §3 layer 5), and a client that appends it instead would leave the
 * retracted text on a child's screen.
 */
export type CoachEvent =
  | { kind: 'chunk'; text: string }
  | { kind: 'replace'; text: string }
  /**
   * The Safety Plane stopped this turn. A decision, and a terminal one — and
   * also doc 12 §5's fail-closed pause, because a layer that could not reach a
   * verdict is a turn nothing screened. The client draws both as "Natalie is
   * taking a break"; a child is owed the same calm surface either way, and the
   * difference between them is a guardian-visible detail, not a child-visible
   * one.
   */
  | { kind: 'blocked' }
  /**
   * The turn could not be attempted — no API key, vendor outage, transport
   * failure. Deliberately NOT `blocked`: conflating "the plane refused" with
   * "the server is misconfigured" sent an unconfigured dev environment into the
   * fail-closed paused state, which locks the composer and reads to a child as
   * Natalie having withdrawn. This is retryable and says so.
   *
   * The line between the two is `SafetyLayerUnavailable`, and nothing else: a
   * MODEL that cannot answer is retryable, a LAYER that cannot answer is not.
   */
  | { kind: 'unavailable' }
  | { kind: 'end' };

/**
 * Reads the learner's band from the server's own record of them. Supplied by
 * the route for the same reason `loadPriorFacts` is: only repositories touch
 * `@acme/payload`. It is a lookup rather than an input because doc 07 §3 layer
 * 1 requires the band be server-injected — a client that could pick its own
 * band could pick the adult crisis register.
 */
export type LoadGradeBand = (ctx: ProtectedCtx) => Promise<'young' | 'older'>;

export async function coachTutorTurn(
  auth: Auth,
  headers: Headers,
  input: CoachTurnInput,
  loadPriorFacts: LoadPriorFacts,
  loadGradeBand: LoadGradeBand,
): Promise<AsyncGenerator<CoachEvent>> {
  return protectedOperation(auth, headers, async (ctx) =>
    coachStream(input, ctx, loadPriorFacts, loadGradeBand),
  );
}

/**
 * The fail-closed boundary, and the reason it is exported.
 *
 * Everything that touches a safety layer on the coaching path happens inside
 * this generator's `try`, including the band lookup — which used to run in
 * `coachTutorTurn` above, one frame outside it, where a failed lookup became a
 * rejected promise, a 500, and a retry into a tutor whose crisis register
 * nothing had resolved. `tooling/check-fail-closed.mjs` fails the build if a
 * safety call is moved back out.
 *
 * It takes `ctx` rather than deriving one so the regression suite can drive the
 * real boundary with a real down layer; identity is still never an input, since
 * the only caller that reaches a child is `coachTutorTurn`, and `ctx` there
 * comes from `protectedOperation`.
 */
export async function* coachStream(
  input: CoachTurnInput,
  ctx: ProtectedCtx,
  loadPriorFacts: LoadPriorFacts,
  loadGradeBand: LoadGradeBand,
): AsyncGenerator<CoachEvent> {
  try {
    // Doc 07 §3 layer 1. A band the server cannot resolve is a layer that is
    // down, not a band to guess at — guessing `young` mis-registers a crisis
    // and guessing `older` hands an eight-year-old the adult one.
    const gradeBand = await safetyLayer('1-identity', () => loadGradeBand(ctx));
    const identity = coachIdentity(ctx, gradeBand);

    const generator = withLearnerBriefStream(
      streamTutorTurn,
      async () => compileLearnerBrief(await loadPriorFacts(ctx), gradeBand, new Date()),
      PEDAGOGY_CONTRACT,
    );

    // The problem travels in the student's turn rather than the brief because
    // the brief is what the system knows about the child, and today's worksheet
    // is not that. It also keeps the cached system prefix stable across turns.
    const turn = input.message
      ? `Problem we are working on: ${input.problem}\n\nStudent: ${input.message}`
      : `Problem we are working on: ${input.problem}\n\nThe student has just shown you this and said nothing yet. Open the coaching.`;

    for await (const event of runSafetyPlaneStream(turn, identity, {
      classifier: coachClassifier,
      generator,
    })) {
      if (event.kind === 'chunk') {
        // The pedagogy post-turn check (doc 18 §3 layer 1) runs per sentence,
        // before the sentence is rendered. Catching a revealed answer after the
        // child has read it is not catching it.
        if (revealsAnswer(input.problem, event.text)) {
          yield { kind: 'replace', text: REVEAL_WITHHELD };
          return;
        }
        yield event;
        continue;
      }

      const { outcome } = event;
      if (outcome.kind === 'reply') yield { kind: 'end' };
      else if (outcome.kind === 'redirect') yield { kind: 'replace', text: outcome.text };
      else if (outcome.kind === 'refused') yield { kind: 'replace', text: outcome.reason };
      else if (outcome.kind === 'crisis') yield { kind: 'replace', text: outcome.response.message };
      else yield { kind: 'blocked' };
      return;
    }
  } catch (error) {
    /*
      The two ways a turn can end without an outcome, and doc 12 §5 wants them
      told apart. A safety layer that could not reach a verdict leaves the turn
      UNSCREENED, so it pauses: `blocked` is what the store maps to `paused`,
      and `paused` is "Natalie is taking a break" — never an error screen at a
      child, and never a retry, because a retry is a second trip past the layer
      that just failed to screen the first one.

      This used to be a bare `catch` justified by "the plane returns an outcome
      rather than throwing", which was true only because L3/L4/L5 were pure
      regex and could not be unavailable. It made the rule vacuous, and the
      first model-backed classifier would have silently inverted it into a retry
      into an unscreened tutor.

      Everything else — no API key, vendor outage, a dropped socket — is the
      model, and the model is not a layer.
    */
    yield { kind: error instanceof SafetyLayerUnavailable ? 'blocked' : 'unavailable' };
  }
}
