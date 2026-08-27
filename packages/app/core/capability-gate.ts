// The plan & entitlement gate — doc 11 §3's block, at the position that ordering
// gives it: after the session has produced a `ProtectedCtx`, before the handler
// runs. It is the boundary `PermissionGate` was being trusted to be and never
// was: a client store can be empty, stale, or absent, and the operation still
// has to refuse.
//
// Pure and I/O-free on purpose. The subscription READ is a port
// (`LoadSubscriptions`), so this decision is testable without a database and
// the same rule runs in dev, in tests, and in production.
//
// It imports `@acme/auth/entitlements` rather than the `@acme/auth` barrel:
// the barrel re-exports the Better Auth React client, so pulling it in here
// would drag a browser client into every server operation (and into the test
// runner, which cannot resolve it at all).
// SOT: docs/pack/11-architectural-guardrails.md §3 · docs/pack/05-monetization-access-spec.md §1.2 · §6
// SOT-KEYWORDS: capability gate entitlement plan server refuse fail-closed protected operation block

import {
  can,
  entitlementsFor,
  subscriptionFor,
  NO_SUBSCRIPTION,
  type Capability,
  type SubscriptionState,
} from '@acme/auth/entitlements';
import type { ProtectedCtx } from './protected-operation.ts';

/**
 * How an operation learns what the caller is paying for. A port, because the
 * only implementation that exists reads Better Auth's tables and this file must
 * stay runnable without them.
 */
export type LoadSubscriptions = (ctx: ProtectedCtx) => Promise<SubscriptionState[]>;

/**
 * Refusal carries the capability and the reference it was judged against so a
 * route can map it and an audit line can name it — and carries NO price, plan
 * name, or upgrade copy. The message crosses the wire, and a learner surface is
 * downstream of every wire (CLAUDE.md · Children's surfaces).
 *
 * 402, not 403: "your plan does not include this" is a different fact from "you
 * may not do this", and a guardian or ops surface needs to tell them apart to
 * respond usefully. The learner side never renders anything from it.
 */
export class CapabilityDenied extends Error {
  readonly status = 402;
  readonly capability: Capability;
  /** The guardian's user id or the organisation id the plan was read for. */
  readonly referenceId: string;

  constructor(capability: Capability, referenceId: string) {
    super(`Capability "${capability}" is not included in the current plan.`);
    this.name = 'CapabilityDenied';
    this.capability = capability;
    this.referenceId = referenceId;
  }
}

/**
 * WHOSE plan applies. Ops work bills to the organisation, everything else to the
 * person — the same rule `useEntitlements` applies on the client
 * (`activeContext.orgId ?? user.id`). The two must agree: if the server judged
 * an org operation against the acting guardian's personal card, a lapsed family
 * plan would lock a paid-up organisation out of its own dashboard.
 *
 * Both halves come off `ctx`, never off input (CLAUDE.md · The block).
 */
export function billingReferenceFor(ctx: ProtectedCtx): string {
  return ctx.orgId ?? ctx.learnerId;
}

/**
 * A capability the floor already grants — one `entitlementsFor` allows with NO
 * subscription at all, which by construction means it is allowed on every status
 * above that too (`practise` and `export` today, per doc 05 §1.2 and §6).
 *
 * DERIVED from the projection rather than listed, so a capability that later
 * stops being free stops being free here in the same edit. It exists because
 * every tutor turn is a `practise` operation, and reading a subscription to
 * answer a question whose answer cannot be "no" would put a database round trip
 * on the child's hot path for nothing.
 */
export function isFloorCapability(capability: Capability): boolean {
  return can(entitlementsFor(NO_SUBSCRIPTION), capability);
}

/** The decision itself, with the subscriptions already in hand. */
export function grants(
  subscriptions: SubscriptionState[],
  referenceId: string,
  capability: Capability,
): boolean {
  return can(entitlementsFor(subscriptionFor(subscriptions, referenceId)), capability);
}

/**
 * Runs `operation` only if the caller's plan includes `capability`.
 *
 * The load happens BEFORE the decision and the operation runs only after it, so
 * there is no path on which a handler executes and is then un-executed. A
 * `LoadSubscriptions` that resolves empty denies every paid capability while
 * leaving `practise` and `export` intact — the direction doc 05 §1.2 and §6
 * require a failure to fall in.
 *
 * A floor capability skips the read entirely; see `isFloorCapability`.
 */
export async function withCapability<R>(
  ctx: ProtectedCtx,
  capability: Capability,
  loadSubscriptions: LoadSubscriptions,
  operation: (ctx: ProtectedCtx) => Promise<R>,
): Promise<R> {
  if (isFloorCapability(capability)) return operation(ctx);

  const referenceId = billingReferenceFor(ctx);
  const subscriptions = await loadSubscriptions(ctx);
  if (!grants(subscriptions, referenceId, capability)) {
    throw new CapabilityDenied(capability, referenceId);
  }
  return operation(ctx);
}
