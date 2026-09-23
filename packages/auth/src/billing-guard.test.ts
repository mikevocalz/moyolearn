// Direct Stripe API callers must obey the same plan boundary as the paywall.
// SOT: packages/auth/src/billing-guard.ts
// SOT-KEYWORDS: billing guard tests organization family authorization
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { billingGuard, permitsBillingPlan } from './billing-guard.ts';
import { isPlanName } from './billing-plans.ts';
import { subscriptionFor } from './entitlements.ts';

describe('billing account boundary', () => {
  it('permits family checkout only for the acting user at quantity one', () => {
    assert.equal(permitsBillingPlan({ plan: 'family', customerType: 'user' }, 'user_1'), true);
    assert.equal(permitsBillingPlan({ plan: 'family', customerType: 'user', referenceId: 'user_2' }, 'user_1'), false);
    assert.equal(permitsBillingPlan({ plan: 'family', customerType: 'organization', referenceId: 'org_1' }, 'user_1'), false);
    assert.equal(permitsBillingPlan({ plan: 'family', customerType: 'user', seats: 4 }, 'user_1'), false);
  });
  it('refuses buying an ops plan for a personal reference', () => {
    assert.equal(permitsBillingPlan({ plan: 'ops-studio', customerType: 'user' }, 'user_1'), false);
    assert.equal(permitsBillingPlan({ plan: 'ops-studio', customerType: 'organization', referenceId: 'user_1' }, 'user_1'), false);
    assert.equal(permitsBillingPlan({ plan: 'ops-studio', customerType: 'organization', referenceId: 'org_1' }, 'user_1'), true);
  });
  it('does not treat inherited object keys as product names', () => {
    for (const name of ['constructor', 'toString', '__proto__', 'missing']) assert.equal(isPlanName(name), false);
  });
  it('does not let a canceled historical row hide a current subscription', () => {
    const canceled = { referenceId: 'user_1', status: 'canceled', plan: 'family', periodEnd: null, seats: null } as const;
    const active = { ...canceled, status: 'active' } as const;
    assert.equal(subscriptionFor([canceled, active], 'user_1').status, 'active');
    assert.equal(subscriptionFor([active, canceled], 'user_1').status, 'active');
  });
});

// Exercise the actual middleware, including Better Auth's cached-session path.
// The context is intentionally partial: no Stripe or database call is needed
// to reject a child's session before the plugin runs.
describe('billing route guard', () => {
  const paths = ['upgrade', 'cancel', 'restore', 'billing-portal', 'list', 'success'];
  const run = (path: string, user: { id?: string; guardianManaged?: boolean; isMinor?: boolean } | null) =>
    Reflect.apply(billingGuard, null, [{
      path: `/subscription/${path}`,
      body: { plan: 'family', customerType: 'user' },
      context: { session: user === null ? null : { user } },
    }]);

  for (const path of paths) {
    for (const flag of ['guardianManaged', 'isMinor'] as const) {
      it(`${path} ${path === 'success' ? 'exempts' : 'refuses'} ${flag} sessions`, async () => {
        const result = run(path, { id: 'learner_1', [flag]: true });
        if (path === 'success') await result;
        else await assert.rejects(result, { status: 'FORBIDDEN' });
      });
    }
    it(`${path} permits an adult session`, async (t) => {
      const previous = process.env.REVENUECAT_ENABLED;
      process.env.REVENUECAT_ENABLED = 'false';
      t.after(() => {
        if (previous === undefined) delete process.env.REVENUECAT_ENABLED;
        else process.env.REVENUECAT_ENABLED = previous;
      });
      await run(path, { id: 'adult_1', guardianManaged: false, isMinor: false });
    });
    it(`${path} ${path === 'success' ? 'exempts' : 'refuses'} missing sessions`, async () => {
      const result = run(path, null);
      if (path === 'success') await result;
      else await assert.rejects(result, { status: 'UNAUTHORIZED' });
    });
  }
  it('returns UNAUTHORIZED for a malformed session', async () => {
    await assert.rejects(run('upgrade', {}), { status: 'UNAUTHORIZED' });
  });
  it('ignores non-billing routes without requiring a session', async () => {
    await billingGuard({ path: '/sign-in/email', context: {} } as Parameters<typeof billingGuard>[0]);
  });
  it('allows an omitted organization reference for the plugin to authorize the active organization', () => {
    assert.equal(permitsBillingPlan({ plan: 'ops-studio', customerType: 'organization' }, 'adult_1'), true);
  });
});
