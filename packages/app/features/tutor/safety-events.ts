// How a coaching turn gets written down when the plane stops it.
//
// `PlaneResult.trace` was built on every turn and dropped on the floor: the
// service read `event.outcome` and never looked at `event.trace`. Doc 07 §3
// layer 7 wants those events in the guarded `safetyEvents` store, doc 12 §5
// wants a fail-closed pause to be GUARDIAN-VISIBLE, and neither can be true of a
// value that never leaves the stack frame that made it.
//
// It is a module rather than four lines inside `coach.service.ts` for a reason
// the check next door makes concrete. `tooling/check-fail-closed.mjs` requires
// every `@acme/safety` binding the boundary imports to be CALLED inside the
// classified `try` — because everything the boundary imports from there is a
// safety layer, and a layer consulted outside the try is a layer whose failure
// escapes as a 500. Recording a pause has to happen in the `catch`, where that
// rule correctly forbids a layer call. Recording is not screening: it happens
// after the verdict, it cannot change it, and it belongs behind its own door.
//
// NOTHING HERE THROWS, and nothing here awaits. `RecordSafetyEvent` returns
// `void` on purpose — see the port's own comment. A write that could reject
// would surface at the boundary's catch as an ordinary error, which is
// `unavailable` → `retry`, so a failed audit write would hand a child a retry
// button into the layer that had just blocked them.
// SOT: docs/pack/07-security-child-ai-safety-spec.md §3 §7 · docs/pack/12-systems-design-prompt.md §5
// SOT-KEYWORDS: safety event record coach turn pause provider refusal trace guardian visible boundary
import 'server-only';
import { ModelDeclined } from '@acme/inference';
import {
  externalRefusalSafetyEvent,
  pausedSafetyEvent,
  safetyEventFor,
  SafetyLayerUnavailable,
  type PlaneLog,
  type PlaneOutcome,
  type SafetyEvent,
} from '@acme/safety';
import type { ProtectedCtx } from '../../core/protected-operation.ts';

/**
 * The port the coaching boundary writes through.
 *
 * `void`, not `Promise<void>`: the record is taken after the verdict and must
 * not be able to change it. The implementation owns its own failure — see
 * `apps/web/lib/safety-event.repository.ts`, which logs a lost write loudly and
 * still hands nothing back.
 *
 * `ctx` first, like `SaveFacts` and `SaveTranscript`: identity reaches a
 * repository from the service boundary, never from a request body.
 */
export type RecordSafetyEvent = (ctx: ProtectedCtx, event: SafetyEvent) => void;

/**
 * `stoppedAt` for a turn the provider's own classifier refused.
 *
 * Not a `SAFETY_LAYERS` value, and deliberately so: this verdict was reached
 * outside our plane, by a classifier we do not run and cannot inspect. Calling
 * it `5-output` would file someone else's decision under one of our layers.
 */
const PROVIDER = 'provider';

/** The conversation the turn belonged to, when the caller holds one. */
export interface TurnScope {
  sessionId: string | null;
}

/**
 * The event a finished plane run earns. Silent for a clean reply and for a
 * refusal — `safetyEventFor` decides, and says why.
 */
export function recordPlaneOutcome(
  record: RecordSafetyEvent,
  ctx: ProtectedCtx,
  outcome: PlaneOutcome,
  trace: readonly PlaneLog[],
  scope: TurnScope,
): void {
  const event = safetyEventFor(outcome, trace, {
    learnerId: ctx.learnerId,
    sessionId: scope.sessionId,
  });
  if (event !== null) record(ctx, event);
}

/**
 * The event a turn that ended in a THROW earns, which is three different things
 * and only two of them are safety.
 *
 * `SafetyLayerUnavailable` — a layer could not answer, so nothing screened the
 * turn. Doc 12 §5's pause, and the one an adult has to be able to see: a tutor
 * that has quietly stopped working is indistinguishable, from the kitchen table,
 * from a child who has quietly stopped trying.
 *
 * `ModelDeclined` — the provider's safety classifier refused. A verdict, not an
 * outage, so it is filed as a `safety` event rather than as a pause.
 *
 * Anything else — no API key, a 429, a dropped socket. Availability, which is
 * `unavailable` → `retry` at the boundary and is NOT a safety event. Writing one
 * would fill the guardian's feed with the operations team's problems.
 */
export function recordTurnFailure(
  record: RecordSafetyEvent,
  ctx: ProtectedCtx,
  error: Error | null,
  scope: TurnScope,
): void {
  const identity = { learnerId: ctx.learnerId, sessionId: scope.sessionId };

  if (error instanceof SafetyLayerUnavailable) {
    record(ctx, pausedSafetyEvent(error.layer, identity));
    return;
  }

  if (error instanceof ModelDeclined) {
    record(ctx, externalRefusalSafetyEvent(PROVIDER, error.category, identity));
    return;
  }

  /*
    Silence, and it costs nothing: every layer on this path is wrapped in
    `safetyLayer`, so a layer that throws something ordinary has already been
    renamed `SafetyLayerUnavailable` before it reaches here and left through the
    branch above. What is left is the model and the wire, which the plane is
    explicit are not layers — and an operations incident in a parent's safety
    feed is worse than no entry at all, because it teaches them to skim it.
  */
}
