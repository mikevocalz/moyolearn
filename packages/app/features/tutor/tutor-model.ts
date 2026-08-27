// The tutoring turn, as a caller of the Inference Gateway.
//
// This file used to be the vendor surface: it held the SDK import, the model
// constant, and the request shape. All three moved to `@acme/inference`, which
// doc 12 §3 makes the sole egress to a model provider — the routing table, the
// pseudonymization scrub and the per-learner budget are only true of every call
// if there is only one place a call can be made from, and a second feature that
// reached for the SDK directly would have been a second place.
//
// What is left is the seam the rest of the coaching path already depends on.
// The only export is still a `ModelStreamCall`, the only thing that accepts one
// is `withLearnerBriefStream`, which returns a `StreamingGenerator`, which only
// `runSafetyPlaneStream` accepts. The Safety Plane is not a convention here; it
// is the only path the types allow, and moving the vendor out did not change
// that.
//
// `tutorTurnFor` takes a learner id where the old constant took nothing. It is
// the BUDGET key and nothing else: it is read from `ProtectedCtx` at the
// service boundary per CLAUDE.md, it is closed over rather than passed on, and
// `TutorPrompt` still has no field it could travel in.
// SOT: docs/design/inference-gateway.md §2 §7 · docs/pack/18-tutor-ai-stack.md §1 §2 · docs/pack/12-systems-design-prompt.md §3 §7
// SOT-KEYWORDS: tutor model claude gateway stream model call adapter vendor budget session complete
import 'server-only';
import { inferenceGateway, type InferenceGateway } from '@acme/inference';
import type { ModelStreamCall } from '@acme/student-model';

/**
 * Streams a coaching turn through the gateway, budgeted against `learnerId`.
 *
 * A learner whose day is spent yields NO TEXT and no error. That is doc 12 §7's
 * "great work today" state and it is deliberately not a failure: throwing here
 * would reach `coach.service.ts`'s catch and offer a child a retry button for
 * having finished their homework, and there is no `CoachEvent` that means
 * "well done, stop" because the composer is meant to have closed before a turn
 * was ever attempted. The screen reads `budgetState` off the session snapshot
 * and does exactly that; this branch is the floor under it, and it is silent on
 * purpose.
 */
export function tutorTurnFor(learnerId: string, gateway: InferenceGateway = inferenceGateway()): ModelStreamCall {
  return ({ system, message }) => ({
    async *[Symbol.asyncIterator]() {
      const turn = await gateway.tutorTurn({ learnerId, payload: { system, message } });
      if (turn.kind === 'session-complete') return;

      yield* turn.stream.text;

      // A safety refusal is not a tutor turn. Ending the stream silently would
      // render as Natalie trailing off mid-thought, so `settled` rejects with
      // `ModelDeclined` and the service turns it into a retryable frame. The
      // budget has already been debited by the time this throws — the tokens
      // were spent whether or not the turn was usable.
      await turn.stream.settled;
    },
  });
}
