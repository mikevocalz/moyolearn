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
// SOT: docs/pack/18-tutor-ai-stack.md §3 · docs/pack/29-shipaton-plan.md §3 · CLAUDE.md §The block
// SOT-KEYWORDS: coach service tutor turn stream protected operation safety plane pedagogy contract
import 'server-only';
import type { Auth } from '@acme/auth/server';
import { runSafetyPlaneStream } from '@acme/safety';
import { compileLearnerBrief, withLearnerBriefStream } from '@acme/student-model';
import { protectedOperation, type ProtectedCtx } from '../../core/protected-operation';
import { coachClassifier, coachIdentity } from './tutor-safety';
import { streamTutorTurn } from './tutor-model';
import { PEDAGOGY_CONTRACT, REVEAL_WITHHELD, revealsAnswer } from './pedagogy';
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
  /** The Safety Plane stopped this turn. A decision, and a terminal one. */
  | { kind: 'blocked' }
  /**
   * The turn could not be attempted — no API key, vendor outage, transport
   * failure. Deliberately NOT `blocked`: conflating "the plane refused" with
   * "the server is misconfigured" sent an unconfigured dev environment into the
   * fail-closed paused state, which locks the composer and reads to a child as
   * Natalie having withdrawn. This is retryable and says so.
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
  return protectedOperation(auth, headers, async (ctx) => {
    const gradeBand = await loadGradeBand(ctx);
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

    return coach(turn, input.problem, identity, generator);
  });
}

async function* coach(
  turn: string,
  problem: string,
  identity: ReturnType<typeof coachIdentity>,
  generator: ReturnType<typeof withLearnerBriefStream>,
): AsyncGenerator<CoachEvent> {
  try {
    for await (const event of runSafetyPlaneStream(turn, identity, {
      classifier: coachClassifier,
      generator,
    })) {
      if (event.kind === 'chunk') {
        // The pedagogy post-turn check (doc 18 §3 layer 1) runs per sentence,
        // before the sentence is rendered. Catching a revealed answer after the
        // child has read it is not catching it.
        if (revealsAnswer(problem, event.text)) {
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
  } catch {
    // Reaching here means generation never completed — the plane itself returns
    // an outcome rather than throwing. So this is infrastructure, not policy.
    yield { kind: 'unavailable' };
  }
}
