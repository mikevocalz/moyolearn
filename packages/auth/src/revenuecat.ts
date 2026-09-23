// RevenueCat projects web and store purchases onto the existing family entitlement.
// Better Auth still owns Stripe checkout; only signed Stripe events import receipts.
// SOT: https://www.revenuecat.com/docs/web/integrations/stripe/track-external-purchases
// SOT-KEYWORDS: revenuecat stripe receipt entitlement subscription server identity
import { z } from 'zod';
import type Stripe from 'stripe';
import type { SubscriptionState } from './entitlements.ts';
import { FAMILY_ENTITLEMENT } from './billing-plans.ts';

const API = 'https://api.revenuecat.com/v1';
const date = z.string().datetime({ offset: true });

// Validate the vendor boundary before any response can grant paid access.
export const revenueCatCustomerSchema = z.object({
  subscriber: z.object({
    management_url: z.url().nullable().optional(),
    entitlements: z.record(z.string(), z.object({
      product_identifier: z.string(),
      expires_date: date.nullable(),
      grace_period_expires_date: date.nullish(),
    })),
    subscriptions: z.record(z.string(), z.object({
      is_sandbox: z.boolean(),
      period_type: z.string(),
      store: z.string(),
      refunded_at: date.nullish(),
      billing_issues_detected_at: date.nullish(),
    })),
  }),
});

export function revenueCatEnabled() {
  return process.env.REVENUECAT_ENABLED === 'true';
}

export function revenueCatFamilyState(
  customer: z.infer<typeof revenueCatCustomerSchema>,
  referenceId: string,
  { now = Date.now(), allowSandbox = false } = {},
): SubscriptionState[] {
  const entitlement = customer.subscriber.entitlements[FAMILY_ENTITLEMENT];
  if (!entitlement) return [];
  const purchase = customer.subscriber.subscriptions[entitlement.product_identifier];
  // Family is recurring. Missing purchase evidence, refunds, and sandbox
  // purchases in production cannot turn an entitlement name into access.
  if (!purchase || purchase.refunded_at || (!allowSandbox && purchase.is_sandbox)) return [];
  const expires = entitlement.expires_date;
  const grace = entitlement.grace_period_expires_date;
  const inPeriod = expires !== null && Date.parse(expires) > now;
  const inGrace = grace != null && Date.parse(grace) > now;
  return [{
    plan: 'family',
    status: !inPeriod && !inGrace ? 'canceled'
      : purchase.period_type === 'trial' ? 'trialing'
      : purchase.billing_issues_detected_at ? 'past_due' : 'active',
    referenceId,
    periodEnd: inGrace ? grace : expires,
    seats: null,
    billingStore: purchase.store,
    ...(customer.subscriber.management_url?.startsWith('https:')
      ? { managementUrl: customer.subscriber.management_url } : {}),
  }];
}

export async function readRevenueCatFamily(
  referenceId: string,
  request: typeof fetch = fetch,
): Promise<SubscriptionState[]> {
  const key = process.env.REVENUECAT_SECRET_API_KEY;
  if (!key) throw new Error('RevenueCat server configuration is incomplete.');
  const response = await request(`${API}/subscribers/${encodeURIComponent(referenceId)}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`RevenueCat customer lookup failed (${response.status}).`);
  const customer = revenueCatCustomerSchema.parse(await response.json());
  const production = process.env.VERCEL_ENV ? process.env.VERCEL_ENV === 'production'
    : process.env.NODE_ENV === 'production';
  return revenueCatFamilyState(customer, referenceId, {
    allowSandbox: process.env.REVENUECAT_ALLOW_SANDBOX === 'true' && !production,
  });
}

export async function importStripeSubscription(
  subscription: Pick<Stripe.Subscription, 'id' | 'metadata'>,
  request: typeof fetch = fetch,
): Promise<void> {
  if (!revenueCatEnabled()) return;
  const metadata = subscription.metadata;
  if (metadata.app !== 'moyolearn' || metadata.customer_type !== 'user') return;
  const userId = metadata.revenuecat_app_user_id;
  if (!userId || metadata.referenceId !== userId) {
    throw new Error('Stripe subscription is missing its verified RevenueCat identity.');
  }
  const key = process.env.REVENUECAT_STRIPE_API_KEY;
  if (!key) throw new Error('RevenueCat Stripe configuration is incomplete.');
  const response = await request(`${API}/receipts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'X-Platform': 'stripe',
    },
    body: JSON.stringify({ app_user_id: userId, fetch_token: subscription.id }),
    signal: AbortSignal.timeout(8_000),
  });
  // Propagate failure through Better Auth's verified webhook handler so Stripe
  // retries. Posting the same subscription again refreshes it idempotently.
  if (!response.ok) throw new Error(`RevenueCat receipt import failed (${response.status}).`);
}

export async function syncStripeEvent(event: Stripe.Event, stripe: Stripe): Promise<void> {
  if (!revenueCatEnabled()) return;
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await importStripeSubscription(event.data.object);
      return;
    case 'invoice.paid':
    case 'invoice.payment_failed': {
      const subscription = event.data.object.parent?.subscription_details?.subscription;
      if (subscription) {
        await importStripeSubscription(typeof subscription === 'string'
          ? await stripe.subscriptions.retrieve(subscription)
          : subscription);
      }
    }
  }
}
