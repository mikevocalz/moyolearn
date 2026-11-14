// Minimal verified invoice projection; no raw customer or invoice data leaves auth.
// SOT: docs/site/signaliq-business-connection.md
// SOT-KEYWORDS: billing payment invoice projection test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import {
  readBillingPreflight,
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
          amount_paid: amount,
          currency: 'usd',
          status_transitions: { paid_at: 1794650400 },
          customer_email: 'never-forward@example.invalid',
          description: 'Never forward freeform content',
          lines: { data: [] },
        },
      },
    }),
  );
}
test('only a positive paid invoice yields the minimal receipt', () => {
  assert.deepEqual(verifiedPaidInvoice(fixture()), {
    invoiceId: 'in_Synthetic',
    customerId: 'cus_Synthetic',
    amountCents: 4900,
    currency: 'USD',
    occurredAt: new Date(1794650400 * 1000).toISOString(),
    live: true,
  });
  assert.equal(
    verifiedPaidInvoice(fixture('checkout.session.completed')),
    null,
  );
  assert.equal(verifiedPaidInvoice(fixture('invoice.paid', 0)), null);
  assert.equal(verifiedPaidInvoice(fixture('invoice.payment_failed')), null);
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
