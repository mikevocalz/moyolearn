// The role refusal, tested where it is decided. Every case here was reachable
// and granted before the gate existed: staff surfaces gated on `write`, which is
// a BILLING capability, so any active family subscription walked a guardian into
// the platform's incident queue. A role is not a plan, and this file holds the
// difference: the refusal is 403-shaped, never CapabilityDenied, and never an
// upsell.
// SOT: docs/pack/11-architectural-guardrails.md §3 · docs/pack/06-auth-onboarding-spec.md §1
// SOT-KEYWORDS: membership gate test role refuse staff org 403 not a paywall fail-closed
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MEMBERSHIP_ROLES } from '@acme/auth/membership';
import { CapabilityDenied } from './capability-gate.ts';
import { MembershipDenied, withMembership, type LoadMembershipRole } from './membership-gate.ts';
import type { ProtectedCtx } from './protected-operation.ts';

const GUARDIAN: ProtectedCtx = { learnerId: 'user_1', isLearner: false };
const IN_ORG: ProtectedCtx = { learnerId: 'user_1', isLearner: false, orgId: 'org_1' };

const holding = (role: string | null): LoadMembershipRole => async () =>
  role !== null && (MEMBERSHIP_ROLES as readonly string[]).includes(role)
    ? (role as (typeof MEMBERSHIP_ROLES)[number])
    : null;

/** Records whether the operation body ever ran. */
const spy = () => {
  const state = { ran: false };
  const operation = async () => {
    state.ran = true;
    return 'result';
  };
  return { state, operation };
};

describe('membership gate — the role step of doc 11 §3', () => {
  it('refuses a caller with no role in the org, and the operation never runs', async () => {
    const { state, operation } = spy();
    await assert.rejects(
      () => withMembership(IN_ORG, ['owner', 'manager'], holding(null), operation),
      MembershipDenied,
    );
    assert.equal(state.ran, false, 'the operation must not run behind a refusal');
  });

  it('refuses a member whose role is outside the required set', async () => {
    await assert.rejects(
      () => withMembership(IN_ORG, ['owner', 'manager'], holding('finance'), spy().operation),
      MembershipDenied,
    );
  });

  it('passes an org member holding a required role', async () => {
    for (const role of ['owner', 'manager'] as const) {
      const { state, operation } = spy();
      const result = await withMembership(IN_ORG, ['owner', 'manager'], holding(role), operation);
      assert.equal(result, 'result');
      assert.equal(state.ran, true, role);
    }
  });

  it('refuses a session with no org at all, without ever reading a role', async () => {
    // A role is a role IN an organisation. A guardian session has no org edge,
    // so there is nothing to look up and the answer is already no.
    let reads = 0;
    const counting: LoadMembershipRole = async () => {
      reads += 1;
      return 'owner';
    };
    await assert.rejects(
      () => withMembership(GUARDIAN, ['owner'], counting, spy().operation),
      MembershipDenied,
    );
    assert.equal(reads, 0);
  });

  it('is a 403-shaped refusal, distinct from the 402 plan gate', async () => {
    const denied = await withMembership(IN_ORG, ['owner'], holding(null), spy().operation).catch(
      (error: Error) => error,
    );
    assert.ok(denied instanceof MembershipDenied);
    assert.equal(denied.status, 403);
    assert.equal(denied instanceof CapabilityDenied, false);
  });

  it('never carries plan, price, or upgrade copy — a role refusal is not a paywall', async () => {
    // The message crosses the wire, and a learner surface is downstream of every
    // wire (CLAUDE.md · Children's surfaces). A refusal that mentioned a plan
    // would also be lying: no purchase changes a role.
    const denied = await withMembership(IN_ORG, ['owner'], holding(null), spy().operation).catch(
      (error: Error) => error,
    );
    assert.ok(denied instanceof MembershipDenied);
    assert.doesNotMatch(denied.message, /\$|upgrade|plan|price|trial|subscri|family|ops-/i);
  });
});
