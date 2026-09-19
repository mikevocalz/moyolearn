// Access and receipt-import regressions at the RevenueCat trust boundary.
// SOT: packages/auth/src/revenuecat.ts
// SOT-KEYWORDS: revenuecat tests refund expiry grace sandbox identity retry
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  revenueCatCustomerSchema, revenueCatFamilyState, readRevenueCatFamily, importStripeSubscription,
} from './revenuecat.ts';

const now = Date.parse('2026-09-19T12:00:00Z');
const future = '2026-10-19T12:00:00Z';
const past = '2026-09-18T12:00:00Z';
const customer = () => revenueCatCustomerSchema.parse({ subscriber: {
  entitlements: { moyo_family: { product_identifier: 'family_monthly', expires_date: future } },
  subscriptions: { family_monthly: {
    is_sandbox: false, period_type: 'normal', store: 'app_store',
  } },
} });

describe('RevenueCat family access', () => {
  it('grants the same family access for Stripe, Apple, and Google purchases', () => {
    for (const store of ['stripe', 'app_store', 'play_store']) {
      const value = customer();
      value.subscriber.subscriptions.family_monthly!.store = store;
      assert.deepEqual(revenueCatFamilyState(value, 'guardian_1', { now }), [{
        plan: 'family', status: 'active', referenceId: 'guardian_1', periodEnd: future, seats: null, billingStore: store,
      }]);
    }
  });

  it('preserves trial status and paid access through the verified grace period', () => {
    const value = customer();
    value.subscriber.subscriptions.family_monthly!.period_type = 'trial';
    assert.equal(revenueCatFamilyState(value, 'guardian', { now })[0]?.status, 'trialing');
    value.subscriber.subscriptions.family_monthly!.period_type = 'normal';
    value.subscriber.subscriptions.family_monthly!.billing_issues_detected_at = past;
    value.subscriber.entitlements.moyo_family!.expires_date = past;
    value.subscriber.entitlements.moyo_family!.grace_period_expires_date = future;
    assert.equal(revenueCatFamilyState(value, 'guardian', { now })[0]?.status, 'past_due');
    value.subscriber.entitlements.moyo_family!.grace_period_expires_date = past;
    assert.equal(revenueCatFamilyState(value, 'guardian', { now })[0]?.status, 'canceled');
  });

  it('does not grant access from a refunded, missing, lifetime, or sandbox purchase', () => {
    const value = customer();
    value.subscriber.subscriptions.family_monthly!.refunded_at = past;
    assert.deepEqual(revenueCatFamilyState(value, 'guardian', { now }), []);
    value.subscriber.subscriptions.family_monthly!.refunded_at = null;
    value.subscriber.subscriptions.family_monthly!.is_sandbox = true;
    assert.deepEqual(revenueCatFamilyState(value, 'guardian', { now }), []);
    assert.equal(revenueCatFamilyState(value, 'guardian', { now, allowSandbox: true })[0]?.status, 'active');
    value.subscriber.subscriptions.family_monthly!.is_sandbox = false;
    value.subscriber.entitlements.moyo_family!.expires_date = null;
    assert.equal(revenueCatFamilyState(value, 'guardian', { now })[0]?.status, 'canceled');
    delete value.subscriber.subscriptions.family_monthly;
    assert.deepEqual(revenueCatFamilyState(value, 'guardian', { now }), []);
  });

  it('refuses malformed dates before projecting access', () => {
    const value = customer();
    value.subscriber.entitlements.moyo_family!.expires_date = 'tomorrow';
    assert.equal(revenueCatCustomerSchema.safeParse(value).success, false);
  });
});

const envNames = ['REVENUECAT_ENABLED', 'REVENUECAT_SECRET_API_KEY', 'REVENUECAT_STRIPE_API_KEY'] as const;
const original = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
afterEach(() => {
  for (const name of envNames) {
    if (original[name] === undefined) delete process.env[name];
    else process.env[name] = original[name];
  }
});

describe('RevenueCat transport', () => {
  it('imports a subscription id with the server-assigned adult identity and Stripe platform', async () => {
    process.env.REVENUECAT_ENABLED = 'true';
    process.env.REVENUECAT_STRIPE_API_KEY = 'test-public-stripe-key';
    let calls = 0;
    const request: typeof fetch = async (url, init) => {
      calls++;
      assert.equal(url, 'https://api.revenuecat.com/v1/receipts');
      assert.equal(new Headers(init?.headers).get('X-Platform'), 'stripe');
      assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer test-public-stripe-key');
      assert.deepEqual(JSON.parse(String(init?.body)), { app_user_id: 'guardian_1', fetch_token: 'sub_1' });
      return new Response('{}');
    };
    const subscription = { id: 'sub_1', metadata: {
      app: 'moyolearn', customer_type: 'user', referenceId: 'guardian_1', revenuecat_app_user_id: 'guardian_1',
    } };
    await importStripeSubscription(subscription, request);
    await importStripeSubscription(subscription, request);
    assert.equal(calls, 2, 'a repeated event refreshes the same receipt, never creates another checkout');
  });

  it('does not mix organization plans or unrelated Stripe products into a family', async () => {
    process.env.REVENUECAT_ENABLED = 'true';
    const request: typeof fetch = async () => { assert.fail('No family receipt should be sent'); };
    await importStripeSubscription({ id: 'sub_org', metadata: { app: 'moyolearn', customer_type: 'organization' } }, request);
    await importStripeSubscription({ id: 'sub_other', metadata: { app: 'another-app', customer_type: 'user' } }, request);
    await assert.rejects(importStripeSubscription({ id: 'sub_1', metadata: {
      app: 'moyolearn', customer_type: 'user', referenceId: 'guardian_1', revenuecat_app_user_id: 'guardian_2',
    } }, request), /verified RevenueCat identity/);
  });

  it('propagates receipt failures so the signed Stripe webhook is retried', async () => {
    process.env.REVENUECAT_ENABLED = 'true';
    process.env.REVENUECAT_STRIPE_API_KEY = 'test-public-stripe-key';
    await assert.rejects(importStripeSubscription({ id: 'sub_1', metadata: {
      app: 'moyolearn', customer_type: 'user', referenceId: 'guardian_1', revenuecat_app_user_id: 'guardian_1',
    } }, async () => new Response('{}', { status: 503 })), /503/);
  });

  it('encodes identity, avoids cached access, and fails closed on an unavailable customer read', async () => {
    process.env.REVENUECAT_SECRET_API_KEY = 'test-server-key';
    const request: typeof fetch = async (url, init) => {
      assert.equal(url, 'https://api.revenuecat.com/v1/subscribers/guardian%2Fa');
      assert.equal(init?.cache, 'no-store');
      assert.equal(new Headers(init?.headers).get('X-Platform'), null);
      return new Response('{}', { status: 503 });
    };
    await assert.rejects(readRevenueCatFamily('guardian/a', request), /503/);
    await assert.rejects(readRevenueCatFamily('guardian', async () => new Response('{}')), /subscriber/);
  });
});
