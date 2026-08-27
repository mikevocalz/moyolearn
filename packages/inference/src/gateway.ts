// The Inference Gateway — the sole egress to a model provider (doc 12 §3, §9.3).
//
// Everything else in the system reaches a model by handing this a value, never
// by holding a client. That is what makes the routing table, the budget, and
// the pseudonymization boundary properties of the system rather than habits: a
// per-route counter is a counter each new route forgets, and the gateway is the
// only call site there is.
//
// The one thing worth reading twice is `tutorTurn`'s return type. Budget
// exhaustion is NOT a failure and NOT a `CoachEvent` — routing it through
// `blocked` would put a child in the fail-closed paused state for having done
// their homework, and routing it through `unavailable` would offer them a retry
// button. So the gateway returns a union whose exhausted arm carries no stream
// at all, and a caller physically cannot read text out of an ended session.
// Doc 12 §7 and doc 07's break-nudge are the same control, and this is the type
// where that pays off.
// SOT: docs/design/inference-gateway.md §5 §6 §7 · docs/pack/12-systems-design-prompt.md §3 §7 §9.3 · CLAUDE.md §Children's surfaces
// SOT-KEYWORDS: inference gateway egress tutor turn classify budget debit routing adapter session complete nudge
import 'server-only';
import { anthropicAdapter } from './anthropic.ts';
import {
  budgetStateFor,
  dayKey,
  endedOnCeiling,
  sharedBudgetLedger,
  BREAK_NUDGE,
  DEFAULT_LEARNER_BUDGET,
  type BudgetLedger,
  type LearnerBudget,
  type SessionBudgetState,
} from './budget.ts';
import { ModelDeclined } from './errors.ts';
import { priceUsd, profileFor } from './models.ts';
import { modelFor, requestFor } from './routing.ts';
import type {
  ClassifierRole,
  InferenceCompletion,
  InferencePayload,
  InferenceStream,
  ProviderAdapter,
} from './types.ts';

/**
 * What a tutoring turn resolves to.
 *
 * `session-complete` is a state, not an error: the composer closes into the
 * end-of-session summary and no provider call is made. There is no third arm
 * for "budget exceeded but here is a stream anyway", which is the shape a
 * boolean flag would have allowed.
 */
export type TutorTurn =
  | { readonly kind: 'stream'; readonly stream: InferenceStream }
  | { readonly kind: 'session-complete' };

/**
 * Identity arrives as a value read from `ProtectedCtx` at the service boundary,
 * per CLAUDE.md. It is the BUDGET key and nothing else — it is not on
 * `InferencePayload`, and there is no path from here to the payload that could
 * put it there.
 */
export interface TutorTurnInput {
  readonly learnerId: string;
  readonly payload: InferencePayload;
  readonly signal?: AbortSignal;
  /** Injected for tests; production reads the wall clock. */
  readonly now?: Date;
}

export interface InferenceGateway {
  tutorTurn(input: TutorTurnInput): Promise<TutorTurn>;
  classify(role: ClassifierRole, payload: InferencePayload): Promise<InferenceCompletion>;
  /** What the tutor screen reads to decide whether the composer is open. */
  budgetState(learnerId: string, now?: Date): Promise<SessionBudgetState>;
}

export interface GatewayOptions {
  readonly adapter: ProviderAdapter;
  readonly ledger: BudgetLedger;
  readonly budget: LearnerBudget;
}

export function createInferenceGateway(options: GatewayOptions): InferenceGateway {
  const { adapter, ledger, budget } = options;

  const stateFor = async (learnerId: string, now: Date): Promise<SessionBudgetState> =>
    budgetStateFor(await ledger.read(learnerId, dayKey(now)), budget);

  return {
    budgetState: (learnerId, now = new Date()) => stateFor(learnerId, now),

    async tutorTurn({ learnerId, payload, signal, now = new Date() }) {
      // Pre-call. A learner past the cap gets no provider call at all, which is
      // the cheapest possible enforcement and the only one that is true when a
      // new caller appears.
      const day = await ledger.read(learnerId, dayKey(now));
      const state = budgetStateFor(day, budget);
      if (state.kind === 'session-complete') {
        /*
          The one place the two ceilings are told apart, and it is a log rather
          than a branch in the UX: hitting the DOLLAR ceiling before the turn
          cap means a turn is costing far more than `capacity.md` predicts,
          which is an operations problem. The child sees the same end-of-session
          summary either way — CLAUDE.md §Children's surfaces, and a surface
          that varied on spend would be a surface that leaked a price.

          No learner id in the line. It is the budget key, and an operations log
          is not a place a child's handle needs to be.
        */
        if (endedOnCeiling(day, budget)) {
          console.warn('[inference] daily USD ceiling reached before the turn cap — check per-turn cost');
        }
        return { kind: 'session-complete' };
      }

      // The nudge is appended to the SYSTEM half so it reaches the coach as
      // policy rather than as something the student said, and so it arrives to
      // the child as coaching text through `chunk` instead of as a wall.
      const nudged: InferencePayload =
        state.kind === 'break-nudge'
          ? { system: `${payload.system}\n\n${BREAK_NUDGE}`, message: payload.message }
          : payload;

      const request = requestFor('tutor-turn', nudged, signal);
      const stream = adapter.stream(request);
      const profile = profileFor(modelFor('tutor-turn'));

      /*
        Post-call, off the render path. `settled` resolves after the iterable is
        exhausted, so a token count never races a sentence, and the debit is
        charged even for a turn the Safety Plane ended as `blocked` — the tokens
        were spent either way, and a budget that refunded screened turns would
        be a budget a prompt-injection loop could run on the house.
      */
      const settled = stream.settled.then(async (outcome) => {
        await ledger.record(learnerId, dayKey(now), priceUsd(profile, outcome.usage));
        if (outcome.stop === 'refusal') {
          // With server-side fallbacks on for this cell, a surviving refusal
          // means the whole chain declined. It is thrown rather than ended
          // silently for the reason `tutor-model.ts` gave first: a stream that
          // just stops renders as Natalie trailing off mid-thought.
          throw new ModelDeclined(outcome.servedBy, outcome.declineCategory);
        }
        return outcome;
      });
      void settled.catch(() => undefined);

      return { kind: 'stream', stream: { text: stream.text, settled } };
    },

    classify(role, payload) {
      // No budget gate. A classification is a safety layer's own call, and a
      // learner whose day is spent must not thereby get an UNSCREENED turn —
      // doc 12 §5 pauses on a layer that cannot answer, and "we ran out of
      // budget" is exactly a layer that cannot answer.
      return adapter.complete(requestFor(role, payload));
    },
  };
}

let shared: InferenceGateway | undefined;

/**
 * The process-wide gateway.
 *
 * A singleton because the ledger is the counter: a gateway per call site would
 * be a budget per call site, which is the failure mode §7.2 names. The adapter
 * is built on first use so a process that never coaches never needs a
 * credential.
 *
 * `sharedBudgetLedger()` rather than a ledger value, and the difference is the
 * whole point of doc 12 §7 holding across a deploy. It is LATE-BOUND: it reads
 * the installed repository on every call, so this singleton may be built by the
 * first route to touch it and still count against Postgres rather than against a
 * Map that dies with the lambda. The composition root that fills it is
 * `apps/web/lib/inference.ts`; with nothing installed it degrades to the
 * process-local counter and says so loudly, once.
 */
export function inferenceGateway(): InferenceGateway {
  shared ??= createInferenceGateway({
    adapter: anthropicAdapter(),
    ledger: sharedBudgetLedger(),
    budget: DEFAULT_LEARNER_BUDGET,
  });
  return shared;
}
