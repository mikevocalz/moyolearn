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

/** Deployment-only read: no customer, invoice, secret or unrelated endpoint output. */
export async function readBillingPreflight(
  key: string,
  endpointUrl: string,
  priceId?: string,
) {
  const stripe = new Stripe(key, { maxNetworkRetries: 1, timeout: 10000 });
  const account = await stripe.accounts.retrieve(null);
  const endpoints = [];
  for await (const endpoint of stripe.webhookEndpoints.list({ limit: 100 })) {
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
  const price = priceId ? await stripe.prices.retrieve(priceId) : null;
  return {
    accountId: account.id,
    endpoints,
    configuredOpsPrice: price
      ? { currency: price.currency.toUpperCase(), live: price.livemode }
      : null,
  };
}
