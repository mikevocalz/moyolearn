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
// SOT-KEYWORDS: coach service tutor turn stream protected operation safety plane pedagogy contract fail closed unavailable paused refusal safety event guardian visible learner flags
import 'server-only';
import type { Auth, LearnerFlags } from '@acme/auth/server';
import { ModelDeclined } from '@acme/inference';
import { runSafetyPlaneStream, safetyLayer, SafetyLayerUnavailable } from '@acme/safety';
import { compileLearnerBrief, withLearnerBriefStream, LEARNER_TURN_LABEL } from '@acme/student-model';
import { protectedOperation, type ProtectedCtx } from '../../core/protected-operation.ts';
import { coachClassifier, coachIdentity } from './tutor-safety.ts';
import { recordPlaneOutcome, recordTurnFailure, type RecordSafetyEvent } from './safety-events.ts';
import { tutorTurnFor } from './tutor-model.ts';
import { PEDAGOGY_CONTRACT, REVEAL_WITHHELD, revealsAnswer } from './pedagogy.ts';
import type { LoadPriorFacts } from './tutor.service';

export interface CoachTurnInput {
  /** The captured or served problem the session is working on. */
  problem: string;
  /** What the student just said. Empty on the opening turn. */
  message: string;
  /**
   * The conversation this turn belongs to, so a safety event can be traced back
   * to the exchange doc 07 §S26 offers a guardian an excerpt of.
   *
   * A handle, not an identity: `learnerId` still comes from `ctx` and is what
   * scopes every read of the event. A client that named someone else's session
   * would only mislabel its own row — the event is still filed against the
   * learner the cookie says it is.
   */
  sessionId?: string;
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
   * A safety verdict stopped this turn. Terminal, and now three things:
   *
   *   · the Safety Plane blocked it;
   *   · doc 12 §5's fail-closed pause — a layer that could not reach a verdict
   *     is a turn nothing screened;
   *   · the PROVIDER'S own classifier refused it (`ModelDeclined`).
   *
   * The client draws all three as "Natalie is taking a break". A child is owed
   * the same calm surface however the turn was stopped, and the differences
   * between them are guardian-visible details, not child-visible ones — they
   * survive as separate rows in `safetyEvents`, which is where an adult reads
   * them.
   */
  | { kind: 'blocked' }
  /**
   * The turn could not be attempted — no API key, vendor outage, transport
   * failure. Deliberately NOT `blocked`: conflating "the plane refused" with
   * "the server is misconfigured" sent an unconfigured dev environment into the
   * fail-closed paused state, which locks the composer and reads to a child as
   * Natalie having withdrawn. This is retryable and says so.
   *
   * The line is `SafetyLayerUnavailable` or `ModelDeclined` on one side and
   * everything else on the other: a model that CANNOT answer is retryable, a
   * layer that cannot answer is not, and a model that WOULD NOT answer has
   * answered — it said no.
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

/**
 * The guardian's policy for this learner (doc 06 §110's `learnerFlags`), read
 * from the server's own record for the same reason the band is.
 *
 * It is layer 1, not a preference: `aiEnabled` is what the plane's `refused`
 * branch honours, so a policy the server cannot resolve is a layer that is down.
 * The boundary reads it inside `safetyLayer('1-identity')`, and
 * `tooling/check-fail-closed.mjs` fails the build if that stops being true.
 */
export type LoadLearnerFlags = (ctx: ProtectedCtx) => Promise<LearnerFlags>;

/**
 * Everything the turn needs from a store, in one object.
 *
 * Four positional ports was already one too many, and the safety-event writer
 * made it six. A bag also makes the composition root read as a list of
 * decisions — `apps/web/app/api/tutor/coach/route.ts` names each binding — rather
 * than as an argument order nobody can check at the call site.
 */
export interface CoachPorts {
  loadPriorFacts: LoadPriorFacts;
  loadGradeBand: LoadGradeBand;
  loadLearnerFlags: LoadLearnerFlags;
  recordSafetyEvent: RecordSafetyEvent;
}

export async function coachTutorTurn(
  auth: Auth,
  headers: Headers,
  input: CoachTurnInput,
  ports: CoachPorts,
): Promise<AsyncGenerator<CoachEvent>> {
  return protectedOperation(auth, headers, async (ctx) => coachStream(input, ctx, ports));
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
  ports: CoachPorts,
): AsyncGenerator<CoachEvent> {
  /*
    The conversation handle, resolved once so the `catch` below can file a pause
    against the same exchange the outcome path would have. It is not identity —
    `recordPlaneOutcome` takes `learnerId` from `ctx` — it is only what lets a
    guardian's alert point at the turn it is about.
  */
  const scope = { sessionId: input.sessionId ?? null };

  try {
    // Doc 07 §3 layer 1. A band the server cannot resolve is a layer that is
    // down, not a band to guess at — guessing `young` mis-registers a crisis
    // and guessing `older` hands an eight-year-old the adult one.
    const gradeBand = await safetyLayer('1-identity', () => ports.loadGradeBand(ctx));
    /*
      The other half of layer 1, and it is a LAYER rather than a lookup for the
      same reason: doc 07 §3 layer 1 names "guardian policy (from `learnerFlags`)"
      in the same breath as the band. A flags read that failed open would run the
      tutor for a child whose parent had switched it off, every time the read
      failed — so an unresolvable policy pauses, exactly like an unresolvable band.
    */
    const flags = await safetyLayer('1-identity', () => ports.loadLearnerFlags(ctx));
    const identity = coachIdentity(ctx, gradeBand, flags);

    /*
      The learner id reaches the gateway as the BUDGET key and stops there — it
      is not a field of `TutorPrompt`, so there is no shape it could travel to
      the provider in. It comes from `ctx` like every other identity on this
      path (CLAUDE.md §The block); a turn whose budget key was a parameter would
      be a turn a client could spend someone else's day on.
    */
    const generator = withLearnerBriefStream(
      tutorTurnFor(ctx.learnerId),
      async () => compileLearnerBrief(await ports.loadPriorFacts(ctx), gradeBand, new Date()),
      PEDAGOGY_CONTRACT,
    );

    // The problem travels in the student's turn rather than the brief because
    // the brief is what the system knows about the child, and today's worksheet
    // is not that. It also keeps the cached system prefix stable across turns.
    const turn = input.message
      ? `Problem we are working on: ${input.problem}\n\n${LEARNER_TURN_LABEL} ${input.message}`
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

      const { outcome, trace } = event;
      /*
        THE TRACE STOPS BEING THROWN AWAY HERE.

        `runSafetyPlaneStream` has always built it — "what ran, in order, the
        duty-of-care paper trail doc 07 §3 layer 8 wants" — and this loop used to
        destructure `outcome` and let the rest fall off the end of the frame. A
        record nobody keeps is doc 12 §5's pause being invisible to the only
        people who can act on it.

        Before the yield, deliberately: the frames below `return` out of the
        loop, and a write placed after them would run on no path at all.
      */
      recordPlaneOutcome(ports.recordSafetyEvent, ctx, outcome, trace, scope);

      if (outcome.kind === 'reply') yield { kind: 'end' };
      else if (outcome.kind === 'redirect') yield { kind: 'replace', text: outcome.text };
      else if (outcome.kind === 'refused') yield { kind: 'replace', text: outcome.reason };
      else if (outcome.kind === 'crisis') yield { kind: 'replace', text: outcome.response.message };
      else yield { kind: 'blocked' };
      return;
    }
  } catch (error) {
    /*
      THREE ways a turn can end without an outcome, and doc 12 §5's failure table
      puts two of them on the same side.

      `SafetyLayerUnavailable` — a layer could not reach a verdict, so the turn
      is UNSCREENED. It pauses: `blocked` is what the store maps to `paused`, and
      `paused` is "Natalie is taking a break" — never an error screen at a child,
      and never a retry, because a retry is a second trip past the layer that
      just failed to screen the first one.

      `ModelDeclined` — the PROVIDER'S OWN safety classifier refused the turn.
      This used to fall through to `unavailable` → `retry`, and that was the bug:
      a refusal is a safety verdict reached by a classifier, not a socket that
      dropped. Doc 12 §5 routes "a surviving refusal" to the fail-closed pause on
      exactly that ground, `packages/inference/src/errors.ts` names the gap and
      leaves it for the change that owns this catch, and this is that change. A
      retry after a refusal asks the same classifier the same question and is
      answered the same way — or, worse, is answered differently, which is a
      child rerolling a safety decision until it goes their way.

      It reuses `blocked` rather than growing the union, and that is the honest
      shape rather than a saving: `blocked`'s own doc comment already says the
      frame means "the Safety Plane stopped this turn… the client draws both as
      'Natalie is taking a break'; a child is owed the same calm surface either
      way, and the difference between them is a guardian-visible detail, not a
      child-visible one". A refusal is a third thing that is guardian-visible and
      child-identical, so it is a third thing that belongs behind this frame. The
      distinction survives where it matters — `recordTurnFailure` files a pause
      and a refusal as different rows.

      Everything else — no API key, vendor outage, a dropped socket — is the
      model, and the model is not a layer.
    */
    const stopped = error instanceof SafetyLayerUnavailable || error instanceof ModelDeclined;

    // Before the yield: this is the only place doc 12 §5's pause becomes visible
    // to an adult, and a consumer that stops iterating on the terminal frame
    // would never reach a write placed after it.
    recordTurnFailure(ports.recordSafetyEvent, ctx, error instanceof Error ? error : null, scope);

    yield { kind: stopped ? 'blocked' : 'unavailable' };
  }
}
