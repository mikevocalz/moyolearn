// The only marketing projection from a signature-verified Stripe webhook.
// SOT: docs/site/signaliq-business-connection.md · packages/auth/src/server.ts
// SOT-KEYWORDS: stripe verified invoice paid minimal payment projection
import Stripe from 'stripe';

const maxPaymentCents = 2147483647; // PostgreSQL integer, shared with the receipt validator.
const referenceId = (value: string | { id: string } | null | undefined) =>
  typeof value === 'string' ? value : value?.id;

function projectPaidInvoice(
  invoice: Stripe.Invoice,
  fallbackOccurredAt: number,
  live: boolean,
  allowedPriceIds: readonly string[],
) {
  const subscriptionId = referenceId(
    invoice.parent?.subscription_details?.subscription,
  );
  const customerId = referenceId(invoice.customer);
  if (
    invoice.status !== 'paid' ||
    !Number.isSafeInteger(invoice.amount_paid) ||
    invoice.amount_paid <= 0 ||
    invoice.amount_paid > maxPaymentCents ||
    !customerId ||
    !subscriptionId
  )
    return null;
  const allowed = new Set(allowedPriceIds);
  const lines = invoice.lines.data;
  const configuredPrice = (line: Stripe.InvoiceLineItem) =>
    allowed.has(referenceId(line.pricing?.price_details?.price) ?? '');
  const sameSubscription = (line: Stripe.InvoiceLineItem) =>
    referenceId(
      line.parent?.subscription_item_details?.subscription ??
        line.parent?.invoice_item_details?.subscription ??
        line.subscription,
    ) === subscriptionId;
  const evidenceStatus =
    invoice.lines.has_more || lines.length === 0
      ? ('incomplete' as const)
      : lines.every((line) => configuredPrice(line) && sameSubscription(line))
        ? ('verified' as const)
        : ('mismatch' as const);
  return {
    invoiceId: invoice.id,
    customerId,
    subscriptionId,
    amountCents: invoice.amount_paid,
    currency: invoice.currency.toUpperCase(),
    occurredAt: new Date(
      (invoice.status_transitions.paid_at ?? fallbackOccurredAt) * 1000,
    ).toISOString(),
    live,
    evidenceStatus,
    moyoPriceSeen: lines.some(configuredPrice),
  };
}

/** Price proof is necessary; the recipient additionally checks the canonical Moyo subscription. */
export function verifiedPaidInvoice(
  event: Stripe.Event,
  allowedPriceIds: readonly string[],
) {
  if (event.type !== 'invoice.paid') return null;
  return projectPaidInvoice(
    event.data.object,
    event.created,
    event.livemode,
    allowedPriceIds,
  );
}

/** Bounded private repair of incomplete evidence; the original receipt date is preserved. */
export async function recheckPaidInvoice(
  key: string,
  invoiceId: string,
  allowedPriceIds: readonly string[],
  originalOccurredAt: string,
  httpClient?: ReturnType<typeof Stripe.createFetchHttpClient>,
) {
  const stripe = new Stripe(key, {
    maxNetworkRetries: 0,
    timeout: 3000,
    ...(httpClient ? { httpClient } : {}),
  });
  const invoice = await stripe.invoices.retrieve(invoiceId);
  if (invoice.lines.has_more)
    invoice.lines = await stripe.invoices.listLineItems(invoiceId, {
      limit: 100,
    });
  return projectPaidInvoice(
    invoice,
    Date.parse(originalOccurredAt) / 1000,
    invoice.livemode,
    allowedPriceIds,
  );
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
            id: price.id,
            currency: price.currency.toUpperCase(),
            live: price.livemode,
          };
        })
      : Promise.resolve({ state: 'not-configured' as const }),
  ]);
  return { account, webhook, opsPrice };
}
