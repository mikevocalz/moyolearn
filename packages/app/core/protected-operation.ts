// Server-side authorization boundary.
// Every operation that reaches the Safety Plane, payload repositories, or the
// learner model must run inside a protectedOperation so identity is never a
// parameter and unauthenticated callers fail closed.
//
// Doc 11 §3 orders the gates inside this block: session → context → permission →
// PLAN & ENTITLEMENT → handler. The plan gate is the last of those and it is
// here, not on the client: `PermissionGate` decides what a screen SHOWS, and a
// screen is not a boundary.
// Doc 12 §7 also makes this the one place uniform telemetry can come from —
// "every operation logs {op, resource, action, ctx.kind, latency, outcome}".
// The record is built and emitted in the `finally` below; the shape, and why
// naming the operation is optional, are in `telemetry.ts`.
// SOT: docs/pack/06-auth-onboarding-spec.md §7 · docs/pack/07-security-child-ai-safety-spec.md §2 · docs/pack/11-architectural-guardrails.md §3 · docs/pack/12-systems-design-prompt.md §7
// SOT-KEYWORDS: protected operation auth boundary server-only learner context mock capability plan entitlement telemetry record latency outcome
import 'server-only';
import { readSubscriptions, type Auth } from '@acme/auth/server';
import type { Capability, SubscriptionState } from '@acme/auth/entitlements';
import { billingReferenceFor, withCapability, CapabilityDenied, type LoadSubscriptions } from './capability-gate.ts';
import {
  ctxKindOf,
  operationRecord,
  recordOperation,
  type OperationCtxKind,
  type OperationDescriptor,
  type OperationOutcome,
} from './telemetry.ts';

export interface ProtectedCtx {
  /** The acting learner's Better Auth user id. */
  learnerId: string;
  /** Whether the account is guardian-managed (a child learner). */
  isLearner: boolean;
  /** Organization id when the session is scoped to one. */
  orgId?: string;
}

export interface ProtectedOperationOptions {
  /**
   * What the operation costs. Defaults to `practise`, which doc 05 §1.2 makes
   * true on every subscription status there is — INCLUDING none at all.
   *
   * That default is the free floor, not an absent gate. An operation whose
   * author forgets this argument runs at a child's practice level and nowhere
   * above it, so forgetting downgrades the operation instead of exempting it.
   * Anything that writes a business's data, moves money, or exports names its
   * capability explicitly.
   *
   * Defaulting to `write` was the other candidate and is wrong here: it would
   * put a lapsed family card between a child and their practice, which doc 05
   * §1.2 and CLAUDE.md both forbid outright.
   */
  requires?: Capability;
  /**
   * Overrides where the caller's plan is read from. Production never passes
   * this — the default reads Better Auth's own subscription rows through the
   * `auth` instance already in hand, so no route has to wire a reader and no
   * route can wire the wrong one.
   */
  loadSubscriptions?: LoadSubscriptions;
  /**
   * What this operation IS, for the telemetry record.
   *
   * Optional on purpose (see `telemetry.ts`): making it required would be an
   * API change to every call site at once, including ones owned elsewhere, and
   * the record is worth more emitted-and-unnamed than not emitted at all. An
   * operation that omits it is recorded as `attributed: false` so the gap is
   * countable on the dashboard rather than invisible.
   */
  telemetry?: OperationDescriptor;
}

const MOCK_CTX: ProtectedCtx = {
  learnerId: 'dev-learner-1',
  isLearner: true,
  /*
    The mock session carries an org too. Without one every org-scoped read
    fails closed to an empty result, and the ops dashboard looks broken in
    exactly the mode it is meant to be developed in.

    It is a REAL slug from the organizations table, not a `dev-org-1`
    placeholder: a mock tenant key that matches no row reads as "the query is
    broken" rather than "you are signed in as nobody".
  */
  orgId: 'riverside-unified',
};

/*
  The mock session's plans, keyed to the mock ctx's own reference ids for the
  same reason the mock org is a real slug: a subscription filed against an id
  nothing matches projects to NO_SUBSCRIPTION, and every paid surface in dev
  would then read as broken rather than as unpaid. `ops-studio` because it is the
  tier carrying a non-zero limit, so doc 06 §4's payout gate is reachable in the
  mode it is developed in.
*/
const MOCK_SUBSCRIPTIONS: SubscriptionState[] = [
  { plan: 'family', status: 'active', referenceId: MOCK_CTX.learnerId, periodEnd: null },
  { plan: 'ops-studio', status: 'active', referenceId: MOCK_CTX.orgId ?? null, periodEnd: null },
];

/**
 * Runs an operation inside an authenticated, learner-scoped context whose plan
 * includes `options.requires`.
 *
 * The caller passes the `Auth` instance and the request headers. This function
 * derives the session and hands the operation a `ProtectedCtx`. It never asks
 * the operation to validate identity or accept an id as input.
 *
 * In dev with `NEXT_PUBLIC_AUTH_MODE=mock`, a deterministic mock learner is
 * used so that features can be exercised without a real Better Auth session.
 * The capability gate still runs against that mock's plans — a dev typo in a
 * capability name has to fail in dev, not first in production.
 */
export async function protectedOperation<R>(
  auth: Auth,
  headers: Headers,
  operation: (ctx: ProtectedCtx) => Promise<R>,
  options: ProtectedOperationOptions = {},
): Promise<R> {
  const capability = options.requires ?? 'practise';
  const isMock =
    process.env.NEXT_PUBLIC_AUTH_MODE === 'mock' && process.env.NODE_ENV === 'development';

  /*
    Captured before the session read, so the recorded latency is the whole block
    — session, capability gate and handler. That is the quantity slo.md §1.1
    budgets at 150 ms for context assembly and LAT-1 measures at p95; timing
    only the handler would hide a slow `getSession` behind a fast operation.
  */
  const startedAt = performance.now();
  let ctxKind: OperationCtxKind = 'anonymous';
  let outcome: OperationOutcome = 'error';

  try {
    if (isMock) {
      ctxKind = ctxKindOf(MOCK_CTX);
      const loadMock: LoadSubscriptions = options.loadSubscriptions ?? (async () => MOCK_SUBSCRIPTIONS);
      const result = await withCapability(MOCK_CTX, capability, loadMock, operation);
      outcome = 'ok';
      return result;
    }

    const session = await auth.api.getSession({ headers });
    if (!session) throw new Error('Unauthenticated');

    const user = session.user as { id: string; guardianManaged?: boolean; orgId?: string };
    const ctx: ProtectedCtx = {
      learnerId: user.id,
      isLearner: !!user.guardianManaged,
      orgId: user.orgId,
    };
    ctxKind = ctxKindOf(ctx);

    const load: LoadSubscriptions =
      options.loadSubscriptions ??
      /*
        Read once per operation and never cached across requests: a subscription
        that lapsed, or a card that just cleared, has to take effect on the next
        call rather than whenever a process happens to recycle.
      */
      ((c) => readSubscriptions(auth, billingReferenceFor(c)));

    const result = await withCapability(ctx, capability, load, operation);
    outcome = 'ok';
    return result;
  } catch (error) {
    /*
      A refusal is not a failure. `denied` and `unauthenticated` are the block
      doing its job, and folding them into `error` would burn SLO-3's budget
      every time a lapsed card is correctly turned away (slo.md §4.4).
    */
    outcome =
      error instanceof CapabilityDenied
        ? 'denied'
        : error instanceof Error && error.message === 'Unauthenticated'
          ? 'unauthenticated'
          : 'error';
    throw error;
  } finally {
    recordOperation(
      operationRecord({
        descriptor: options.telemetry,
        capability,
        ctxKind,
        outcome,
        latencyMs: performance.now() - startedAt,
        authMode: isMock ? 'mock' : 'session',
      }),
    );
  }
}
