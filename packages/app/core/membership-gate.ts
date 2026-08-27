// The membership/role gate — doc 11 §3's block, at the position that ordering
// gives it: after the session has produced a `ProtectedCtx` and its org scope,
// BEFORE the plan & entitlement gate. It exists because the plan gate was being
// trusted to be a staff wall and never was: `write` is a BILLING capability, so
// any active family subscription satisfied it, and a paying guardian could read
// and mutate the platform's incident triage queue.
//
// A role is not a plan. The refusal here is 403-shaped and deliberately NOT a
// `CapabilityDenied`: a 402 is an upsell surface, and there is nothing to sell —
// no purchase confers a role. The message carries no plan, price, or upgrade
// copy for the same reason the capability gate's carries none: it crosses the
// wire, and a learner surface is downstream of every wire.
//
// Pure and I/O-free on purpose, like the capability gate beside it. The role
// READ is a port (`LoadMembershipRole`); the only real implementation is
// `readMembershipRole` in `@acme/auth`, wired by `protectedOperation`.
// SOT: docs/pack/11-architectural-guardrails.md §3 · docs/pack/06-auth-onboarding-spec.md §1
// SOT-KEYWORDS: membership gate role staff org refuse 403 not a paywall fail-closed protected operation block

import type { MembershipRole } from '@acme/auth/membership';
import type { ProtectedCtx } from './protected-operation.ts';

/**
 * How an operation learns the caller's role in `ctx.orgId`. A port, because the
 * implementation reads Better Auth's `member` table and this file must stay
 * runnable without it. `null` means no role, and no role means no.
 */
export type LoadMembershipRole = (ctx: ProtectedCtx) => Promise<MembershipRole | null>;

/**
 * At least one role, enforced by the type: a role gate with an empty allow-list
 * would be a gate that admits nobody while reading as "un-gated" at the call
 * site, and neither meaning is one an author should be able to write.
 */
export type RequiredMembership = readonly [MembershipRole, ...MembershipRole[]];

/**
 * Refusal names what was required and what was held so an audit line can say
 * why — and carries NO plan, price, or upgrade copy. 403, not 402: "you may not
 * do this" is a different fact from "your plan does not include this", and only
 * the second is ever allowed to become a paywall.
 */
export class MembershipDenied extends Error {
  readonly status = 403;
  readonly required: RequiredMembership;
  /** The role the caller actually holds in the org, if any. */
  readonly held: MembershipRole | null;

  constructor(required: RequiredMembership, held: MembershipRole | null) {
    super('This operation requires an organisation role this account does not hold.');
    this.name = 'MembershipDenied';
    this.required = required;
    this.held = held;
  }
}

/**
 * Runs `operation` only if the caller holds one of `required` in `ctx.orgId`.
 *
 * A session with NO org refuses without reading the port at all: a role is a
 * role IN an organisation, so a guardian or learner session has nothing to look
 * up and the answer is already no. Identity comes off `ctx` on both sides of
 * the port — never off input (CLAUDE.md · The block).
 */
export async function withMembership<R>(
  ctx: ProtectedCtx,
  required: RequiredMembership,
  loadMembershipRole: LoadMembershipRole,
  operation: (ctx: ProtectedCtx) => Promise<R>,
): Promise<R> {
  if (!ctx.orgId) throw new MembershipDenied(required, null);

  const held = await loadMembershipRole(ctx);
  if (held === null || !required.includes(held)) {
    throw new MembershipDenied(required, held);
  }
  return operation(ctx);
}
