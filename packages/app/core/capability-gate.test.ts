// The server refusal, tested where it is decided. Every case here was reachable
// and granted before the gate existed: `protectedOperation` checked a session and
// nothing else, so "the server enforces the real boundary anyway" was false for
// every capability the client was pretending to gate.
// SOT-KEYWORDS: capability gate test entitlement plan refuse server fail-closed practise export write
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SubscriptionState, SubscriptionStatus } from '@acme/auth/entitlements';
import {
  CapabilityDenied,
  billingReferenceFor,
  grants,
  isFloorCapability,
  withCapability,
  type LoadSubscriptions,
} from './capability-gate.ts';
import type { ProtectedCtx } from './protected-operation.ts';

const GUARDIAN: ProtectedCtx = { learnerId: 'user_1', isLearner: false };
const IN_ORG: ProtectedCtx = { learnerId: 'user_1', isLearner: false, orgId: 'org_1' };

const sub = (over: Partial<SubscriptionState>): SubscriptionState => ({
  plan: 'family',
  status: 'active',
  referenceId: 'user_1',
  periodEnd: null,
  seats: null,
  ...over,
});

const loading = (subscriptions: SubscriptionState[]): LoadSubscriptions => async () => subscriptions;

/** Records whether the operation body ever ran. */
const spy = () => {
  const state = { ran: false };
  const operation = async () => {
    state.ran = true;
    return 'result';
  };
  return { state, operation };
};

describe('server capability gate', () => {
  it('refuses a paid capability when the caller has no subscription at all', async () => {
    const { state, operation } = spy();
    await assert.rejects(
      () => withCapability(GUARDIAN, 'write', loading([]), operation),
      (error: Error) => error instanceof CapabilityDenied && error.capability === 'write',
    );
    assert.equal(state.ran, false, 'the operation must not run behind a refusal');
  });

  it('refuses even though the client asked for it', async () => {
    // The client "asking" is the only way an operation is ever invoked. The
    // request reaching the handler is not evidence of anything.
    const canceled = loading([sub({ status: 'canceled' })]);
    await assert.rejects(() => withCapability(GUARDIAN, 'write', canceled, spy().operation), CapabilityDenied);
  });

  it('refuses when the subscription belongs to somebody else', async () => {
    const someoneElse = loading([sub({ referenceId: 'user_2', status: 'active' })]);
    await assert.rejects(() => withCapability(GUARDIAN, 'write', someoneElse, spy().operation), CapabilityDenied);
  });

  it('runs the operation when the plan covers it', async () => {
    const { state, operation } = spy();
    const result = await withCapability(GUARDIAN, 'write', loading([sub({})]), operation);
    assert.equal(result, 'result');
    assert.equal(state.ran, true);
  });

  it('never carries plan or price copy into the refusal', async () => {
    // The message crosses the wire, and a learner surface is downstream of every
    // wire (CLAUDE.md · Children's surfaces).
    const denied = await withCapability(GUARDIAN, 'write', loading([]), spy().operation).catch(
      (error: Error) => error,
    );
    assert.ok(denied instanceof CapabilityDenied);
    assert.doesNotMatch(denied.message, /\$|upgrade|trial|family|ops-/i);
    assert.equal(denied.status, 402);
  });
});

describe('capability gate — doc 05 floors survive a lapsed plan', () => {
  const STATUSES: SubscriptionStatus[] = [
    'none',
    'trialing',
    'active',
    'past_due',
    'canceled',
    'incomplete',
  ];

  it('keeps a child practising on every status there is', async () => {
    for (const status of STATUSES) {
      const { state, operation } = spy();
      await withCapability(GUARDIAN, 'practise', loading([sub({ status })]), operation);
      assert.equal(state.ran, true, status);
    }
  });

  it('keeps practise reachable with no subscription row at all', async () => {
    const { state, operation } = spy();
    await withCapability(GUARDIAN, 'practise', loading([]), operation);
    assert.equal(state.ran, true);
  });

  it('does not read a subscription to answer a question that cannot be no', async () => {
    // Every tutor turn is a `practise` operation; a database round trip on the
    // child's hot path for a guaranteed `true` is a cost with no decision behind
    // it. The paid capabilities must still read.
    let reads = 0;
    const counting: LoadSubscriptions = async () => {
      reads += 1;
      return [];
    };
    await withCapability(GUARDIAN, 'practise', counting, spy().operation);
    await withCapability(GUARDIAN, 'export', counting, spy().operation);
    assert.equal(reads, 0);
    assert.equal(isFloorCapability('practise'), true);
    assert.equal(isFloorCapability('export'), true);
    assert.equal(isFloorCapability('write'), false);
    assert.equal(isFloorCapability('payout-automation'), false);

    await assert.rejects(() => withCapability(GUARDIAN, 'write', counting, spy().operation));
    assert.equal(reads, 1);
  });

  it('keeps export reachable after cancellation', async () => {
    const { state, operation } = spy();
    await withCapability(GUARDIAN, 'export', loading([sub({ status: 'canceled' })]), operation);
    assert.equal(state.ran, true);
  });

  it('lets past_due keep writing and stops canceled', async () => {
    await withCapability(GUARDIAN, 'write', loading([sub({ status: 'past_due' })]), spy().operation);
    await assert.rejects(
      () => withCapability(GUARDIAN, 'write', loading([sub({ status: 'canceled' })]), spy().operation),
      CapabilityDenied,
    );
  });
});

describe('capability gate — which plan applies', () => {
  it('bills an org operation to the org, not the acting person', () => {
    assert.equal(billingReferenceFor(IN_ORG), 'org_1');
    assert.equal(billingReferenceFor(GUARDIAN), 'user_1');
  });

  it("does not let a guardian's lapsed card lock their organisation out", async () => {
    const subscriptions = [
      sub({ referenceId: 'user_1', status: 'canceled' }),
      sub({ referenceId: 'org_1', plan: 'ops-studio', status: 'active' }),
    ];
    const { state, operation } = spy();
    await withCapability(IN_ORG, 'write', loading(subscriptions), operation);
    assert.equal(state.ran, true);
  });

  it("does not let an org's plan cover the guardian's personal surface", () => {
    const subscriptions = [sub({ referenceId: 'org_1', plan: 'ops-studio', status: 'active' })];
    assert.equal(grants(subscriptions, billingReferenceFor(GUARDIAN), 'write'), false);
  });

  it('gates payout automation at Studio', async () => {
    const solo = [sub({ referenceId: 'org_1', plan: 'ops-solo', status: 'active' })];
    const studio = [sub({ referenceId: 'org_1', plan: 'ops-studio', status: 'active' })];
    await assert.rejects(
      () => withCapability(IN_ORG, 'payout-automation', loading(solo), spy().operation),
      CapabilityDenied,
    );
    const { state, operation } = spy();
    await withCapability(IN_ORG, 'payout-automation', loading(studio), operation);
    assert.equal(state.ran, true);
  });

  it('names the reference it judged against so a refusal is auditable', async () => {
    const denied = await withCapability(IN_ORG, 'write', loading([]), spy().operation).catch(
      (error: Error) => error,
    );
    assert.ok(denied instanceof CapabilityDenied);
    assert.equal(denied.referenceId, 'org_1');
  });
});
