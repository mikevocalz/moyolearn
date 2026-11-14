// The only marketing projection from a signature-verified Stripe webhook.
// SOT: docs/site/signaliq-business-connection.md · packages/auth/src/server.ts
// SOT-KEYWORDS: stripe verified invoice paid minimal payment projection
import Stripe from 'stripe';

export function verifiedPaidInvoice(event: Stripe.Event) {
  if (event.type !== 'invoice.paid') return null;
  const invoice = event.data.object;
  if (
    invoice.status !== 'paid' ||
    invoice.amount_paid <= 0 ||
    !invoice.customer
  )
    return null;
  const customerId =
    typeof invoice.customer === 'string'
      ? invoice.customer
      : invoice.customer.id;
  return {
    invoiceId: invoice.id,
    customerId,
    amountCents: invoice.amount_paid,
    currency: invoice.currency.toUpperCase(),
    occurredAt: new Date(
      (invoice.status_transitions.paid_at ?? event.created) * 1000,
    ).toISOString(),
    live: event.livemode,
  };
}
export type VerifiedBillingPayment = NonNullable<
  ReturnType<typeof verifiedPaidInvoice>
>;

/** Deployment-only reads. Each result survives an unrelated permission failure. */
const safeBillingCode = (value?: string) =>
  value &&
  /^[a-zA-Z][a-zA-Z0-9_]{0,79}$/.test(value) &&
  !/(?:sk|rk|pk)_(?:live|test)_|whsec_/i.test(value)
    ? value
    : null;
async function inspectBillingStep<T>(read: () => Promise<T>) {
  try {
    return { state: 'ok' as const, value: await read() };
  } catch (error) {
    const stripeError =
      error instanceof Stripe.errors.StripeError ? error : null;
    return {
      state: 'failed' as const,
      error: {
        type: safeBillingCode(stripeError?.type) ?? 'UnclassifiedError',
        status: stripeError?.statusCode ?? null,
        code: safeBillingCode(stripeError?.code),
      },
    };
  }
}
export async function readBillingPreflight(
  key: string,
  endpointUrl: string,
  priceId?: string,
  httpClient?: ReturnType<typeof Stripe.createFetchHttpClient>,
) {
  const stripe = new Stripe(key, {
    maxNetworkRetries: 1,
    timeout: 10000,
    ...(httpClient ? { httpClient } : {}),
  });
  const [account, webhook, opsPrice] = await Promise.all([
    inspectBillingStep(async () => ({
      accountId: (await stripe.accounts.retrieve(null)).id,
    })),
    inspectBillingStep(async () => {
      const endpoints = [];
      for await (const endpoint of stripe.webhookEndpoints.list({
        limit: 100,
      })) {
        if (endpoint.url.replace(/\/$/, '') !== endpointUrl) continue;
        endpoints.push({
          id: endpoint.id,
          url: endpoint.url,
          status: endpoint.status,
          enabledEvents: endpoint.enabled_events,
          invoicePaidEnabled:
            endpoint.enabled_events.includes('*') ||
            endpoint.enabled_events.includes('invoice.paid'),
        });
      }
      return { endpoints };
    }),
    priceId
      ? inspectBillingStep(async () => {
          const price = await stripe.prices.retrieve(priceId);
          return {
            currency: price.currency.toUpperCase(),
            live: price.livemode,
          };
        })
      : Promise.resolve({ state: 'not-configured' as const }),
  ]);
  return { account, webhook, opsPrice };
}
