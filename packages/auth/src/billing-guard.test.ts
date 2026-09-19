// Direct Stripe API callers must obey the same plan boundary as the paywall.
// SOT: packages/auth/src/billing-guard.ts
// SOT-KEYWORDS: billing guard tests organization family authorization
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { permitsBillingPlan } from './billing-guard.ts';
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
