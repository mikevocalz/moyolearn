// The Block's role step, proven end-to-end through `protectedOperation` in mock
// mode — the exact identity the vulnerability was reported against: the dev
// mock is a guardian-managed learner whose household AND org subscriptions are
// active, so every billing capability up to `write` says yes. The role step has
// to say no anyway.
//
// `.server-test.ts` because the block imports `@acme/auth/server`, which is
// server-only. Mock mode never dereferences the `Auth` instance — the assertion
// below is the test's statement of that fact, not a convenience.
// SOT: docs/pack/11-architectural-guardrails.md §3 · docs/pack/06-auth-onboarding-spec.md §1
// SOT-KEYWORDS: protected operation server test membership role step mock refuse ordering staff
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { Auth } from '@acme/auth/server';
import { MEMBERSHIP_ROLES } from '@acme/auth/membership';
import { MembershipDenied } from './membership-gate.ts';
import { protectedOperation } from './protected-operation.ts';
import { setOperationSink } from './telemetry.ts';

/** Never touched on the mock path; the cast records that, it does not hide it. */
const AUTH_UNUSED = {} as Auth;
const HEADERS = new Headers();

before(() => {
  process.env.NEXT_PUBLIC_AUTH_MODE = 'mock';
  process.env.NODE_ENV = 'development';
  setOperationSink(() => {});
});
after(() => {
  delete process.env.NEXT_PUBLIC_AUTH_MODE;
  setOperationSink(null);
});

const spy = () => {
  const state = { ran: false };
  const operation = async () => {
    state.ran = true;
    return 'result';
  };
  return { state, operation };
};

describe('the block — a paying guardian is not staff', () => {
  it('refuses the dev mock a role-gated `write` operation despite two active subscriptions', async () => {
    // Exactly the incident-triage shape: `requires: 'write'` passes on the
    // mock's active plans, so before the role step existed this ran.
    const { state, operation } = spy();
    await assert.rejects(
      () =>
        protectedOperation(AUTH_UNUSED, HEADERS, operation, {
          requires: 'write',
          requiresMembership: ['owner', 'manager'],
        }),
      MembershipDenied,
    );
    assert.equal(state.ran, false);
  });

  it('refuses the dev mock the ops list even at the `export` floor', async () => {
    // The ops-leads read is `export` — free on every status — so the ROLE is
    // the only wall between a family session and the org pipeline.
    await assert.rejects(
      () =>
        protectedOperation(AUTH_UNUSED, HEADERS, spy().operation, {
          requires: 'export',
          requiresMembership: MEMBERSHIP_ROLES,
        }),
      MembershipDenied,
    );
  });

  it('passes an org member holding a required role', async () => {
    const { state, operation } = spy();
    const result = await protectedOperation(AUTH_UNUSED, HEADERS, operation, {
      requires: 'write',
      requiresMembership: ['owner', 'manager'],
      loadMembershipRole: async () => 'manager',
    });
    assert.equal(result, 'result');
    assert.equal(state.ran, true);
  });

  it('runs the role step before the plan gate — a role refusal is never a paywall', async () => {
    // Doc 11 §3's ordering: membership/role, THEN plan & entitlement. With no
    // role and no subscriptions both gates would refuse; the one that speaks
    // must be the 403, because the 402 is an upsell surface and a role refusal
    // has nothing to sell.
    const denied = await protectedOperation(AUTH_UNUSED, HEADERS, spy().operation, {
      requires: 'write',
      requiresMembership: ['owner'],
      loadSubscriptions: async () => [],
    }).catch((error: Error) => error);
    assert.ok(denied instanceof MembershipDenied);
    assert.equal(denied.status, 403);
    assert.doesNotMatch(denied.message, /\$|upgrade|plan|price|trial|subscri/i);
  });

  it('leaves un-gated operations exactly as they were', async () => {
    const { state, operation } = spy();
    await protectedOperation(AUTH_UNUSED, HEADERS, operation, { requires: 'write' });
    assert.equal(state.ran, true);
  });
});
