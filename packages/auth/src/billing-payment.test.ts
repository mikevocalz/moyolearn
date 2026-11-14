// Minimal verified invoice projection; no raw customer or invoice data leaves auth.
// SOT: docs/site/signaliq-business-connection.md
// SOT-KEYWORDS: billing payment invoice projection test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import {
  readBillingPreflight,
  recheckPaidInvoice,
  verifiedPaidInvoice,
} from './billing-payment.ts';

function fixture(type = 'invoice.paid', amount = 4900): Stripe.Event {
  return JSON.parse(
    JSON.stringify({
      type,
      created: 1794650400,
      livemode: true,
      data: {
        object: {
          id: 'in_Synthetic',
          status: 'paid',
          customer: 'cus_Synthetic',
          livemode: true,
          parent: {
            type: 'subscription_details',
            subscription_details: { subscription: 'sub_Moyo' },
          },
          amount_paid: amount,
          currency: 'usd',
          status_transitions: { paid_at: 1794650400 },
          customer_email: 'never-forward@example.invalid',
          description: 'Never forward freeform content',
          lines: {
            object: 'list',
            has_more: false,
            url: '/v1/invoices/in_Synthetic/lines',
            data: [
              {
                id: 'il_Synthetic',
                pricing: {
                  type: 'price_details',
                  price_details: { price: 'price_Moyo', product: 'prod_Moyo' },
                },
                parent: {
                  type: 'subscription_item_details',
                  subscription_item_details: { subscription: 'sub_Moyo' },
                },
              },
            ],
          },
        },
      },
    }),
  );
}
test('only a positive paid invoice yields the minimal receipt', () => {
  assert.deepEqual(verifiedPaidInvoice(fixture(), ['price_Moyo']), {
    invoiceId: 'in_Synthetic',
    customerId: 'cus_Synthetic',
    subscriptionId: 'sub_Moyo',
    amountCents: 4900,
    currency: 'USD',
    occurredAt: new Date(1794650400 * 1000).toISOString(),
    live: true,
    evidenceStatus: 'verified',
    moyoPriceSeen: true,
  });
  assert.equal(
    verifiedPaidInvoice(fixture('checkout.session.completed'), ['price_Moyo']),
    null,
  );
  assert.equal(
    verifiedPaidInvoice(fixture('invoice.paid', 0), ['price_Moyo']),
    null,
  );
  assert.equal(
    verifiedPaidInvoice(fixture('invoice.payment_failed'), ['price_Moyo']),
    null,
  );
});

function invoiceFixture() {
  const event = fixture();
  if (event.type !== 'invoice.paid')
    throw new Error('Invalid synthetic fixture.');
  return event;
}
test('mixed prices, another subscription and incomplete lines never prove Moyo revenue', () => {
  const event = invoiceFixture();
  const invoice = event.data.object;
  const line = invoice.lines.data[0];
  assert.ok(
    line?.pricing?.price_details && line.parent?.subscription_item_details,
  );
  invoice.lines.data.push({
    ...line,
    pricing: {
      ...line.pricing,
      price_details: {
        ...line.pricing.price_details,
        price: 'price_Unrelated',
      },
    },
  });
  assert.equal(
    verifiedPaidInvoice(event, ['price_Moyo'])?.evidenceStatus,
    'mismatch',
  );
  invoice.lines.data.pop();
  line.parent.subscription_item_details.subscription = 'sub_Unrelated';
  assert.equal(
    verifiedPaidInvoice(event, ['price_Moyo'])?.evidenceStatus,
    'mismatch',
  );
  line.parent.subscription_item_details.subscription = 'sub_Moyo';
  invoice.lines.has_more = true;
  assert.equal(
    verifiedPaidInvoice(event, ['price_Moyo'])?.evidenceStatus,
    'incomplete',
  );
  invoice.lines.has_more = false;
  assert.equal(
    verifiedPaidInvoice(event, ['price_Unrelated'])?.moyoPriceSeen,
    false,
  );
  assert.equal(
    verifiedPaidInvoice(event, ['price_Unrelated'])?.evidenceStatus,
    'mismatch',
  );
  invoice.parent = null;
  assert.equal(
    verifiedPaidInvoice(event, ['price_Moyo']),
    null,
    'a one-off invoice has no subscription attribution',
  );
});
test('paid cents must fit the real integer receipt column', () => {
  assert.equal(
    verifiedPaidInvoice(fixture('invoice.paid', 2147483647), ['price_Moyo'])
      ?.amountCents,
    2147483647,
  );
  assert.equal(
    verifiedPaidInvoice(fixture('invoice.paid', 2147483648), ['price_Moyo']),
    null,
  );
  assert.equal(
    verifiedPaidInvoice(fixture('invoice.paid', 49.5), ['price_Moyo']),
    null,
  );
});
test('verified invoice projection preserves Stripe units for immutable currency evidence', () => {
  for (const [currency, amount] of [
    ['isk', 70000],
    ['ugx', 70000],
    ['mga', 700],
  ] as const) {
    const event = invoiceFixture();
    event.data.object.currency = currency;
    event.data.object.amount_paid = amount;
    const receipt = verifiedPaidInvoice(event, ['price_Moyo']);
    assert.equal(receipt?.amountCents, amount);
    assert.equal(receipt?.currency, currency.toUpperCase());
  }
});
test('private repair reads complete line evidence and never rewrites the original paid time', async () => {
  const invoice = invoiceFixture().data.object;
  invoice.lines.has_more = true;
  invoice.status_transitions.paid_at = null;
  const calls: string[] = [];
  const http = Stripe.createFetchHttpClient(async (url) => {
    const path = new URL(String(url)).pathname;
    calls.push(path);
    if (path.endsWith('/lines'))
      return Response.json({ ...invoice.lines, has_more: false });
    return Response.json(invoice);
  });
  const original = '2026-11-14T10:00:00.000Z';
  const result = await recheckPaidInvoice(
    'sk_test_synthetic_fixture',
    invoice.id,
    ['price_Moyo'],
    original,
    http,
  );
  assert.equal(result?.evidenceStatus, 'verified');
  assert.equal(result?.occurredAt, original);
  assert.deepEqual(calls, [
    '/v1/invoices/in_Synthetic',
    '/v1/invoices/in_Synthetic/lines',
  ]);
});

test('billing preflight preserves independent successes and never outputs Stripe error messages or keys', async () => {
  const calls: string[] = [];
  const http = Stripe.createFetchHttpClient(async (url) => {
    const path = new URL(String(url)).pathname;
    calls.push(path);
    if (path === '/v1/account') return Response.json({ id: 'acct_Synthetic' });
    return Response.json(
      {
        error: {
          type: 'invalid_request_error',
          code:
            path === '/v1/webhook_endpoints'
              ? 'permission_missing'
              : 'resource_missing',
          message: 'MUST NOT LOG sk_live_synthetic_secret',
          headers: { authorization: 'MUST NOT LOG' },
        },
      },
      { status: path === '/v1/webhook_endpoints' ? 403 : 404 },
    );
  });
  const result = await readBillingPreflight(
    'sk_test_synthetic_fixture',
    'https://app.moyolearn.com/api/auth/stripe/webhook',
    'price_Synthetic',
    http,
  );
  assert.deepEqual(result.account, {
    state: 'ok',
    value: { accountId: 'acct_Synthetic' },
  });
  assert.equal(result.webhook.state, 'failed');
  assert.equal('error' in result.webhook && result.webhook.error.status, 403);
  assert.equal(result.opsPrice.state, 'failed');
  assert.ok(calls.includes('/v1/prices/price_Synthetic'));
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes('MUST NOT LOG'), false);
  assert.equal(serialized.includes('sk_live'), false);
  assert.equal(serialized.includes('headers'), false);
});
