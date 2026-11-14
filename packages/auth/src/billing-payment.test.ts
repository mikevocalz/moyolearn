// Minimal verified invoice projection; no raw customer or invoice data leaves auth.
// SOT: docs/site/signaliq-business-connection.md
// SOT-KEYWORDS: billing payment invoice projection test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type Stripe from 'stripe';
import { verifiedPaidInvoice } from './billing-payment.ts';

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
