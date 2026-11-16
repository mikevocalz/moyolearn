// Exact Stripe-to-ISO conversion; all amounts and invoices are synthetic.
// SOT: docs/site/signaliq-business-connection.md
// SOT-KEYWORDS: marketing currency payment conversion regression
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripeInvoiceToIsoMinor } from '../../../../packages/app/marketing/payment-units.ts';

test('invoice compatibility units become ISO units without changing the currency value', () => {
  const cases: [string, number, number, number, string][] = [
    ['USD', 4900, 4900, 2, '49.00'],
    ['JPY', 700, 700, 0, '700'],
    ['KWD', 12345, 12345, 3, '12.345'],
    ['ISK', 70000, 700, 0, '700'],
    ['UGX', 70000, 700, 0, '700'],
    ['MGA', 700, 70000, 2, '700.00'],
    // These are invoice charges, not HUF/TWD payouts.
    ['HUF', 1045, 1045, 2, '10.45'],
    ['TWD', 80045, 80045, 2, '800.45'],
  ];
  for (const [currency, raw, expected, digits, display] of cases) {
    assert.equal(stripeInvoiceToIsoMinor(raw, currency), expected, currency);
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      currencyDisplay: 'code',
      useGrouping: false,
      // Intl/CLDR display defaults can differ from ISO storage units (MGA/HUF).
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    assert.equal(
      formatter
        .formatToParts(expected / 10 ** digits)
        .filter((part) =>
          ['integer', 'decimal', 'fraction'].includes(part.type),
        )
        .map((part) => part.value)
        .join(''),
      display,
      `${currency} must display the original monetary value with ISO units`,
    );
  }
});

test('rejects fractional ISO units, invalid raw amounts and conversion overflow without rounding', () => {
  for (const currency of ['ISK', 'UGX']) {
    assert.equal(stripeInvoiceToIsoMinor(1, currency), null);
    assert.equal(stripeInvoiceToIsoMinor(501, currency), null);
    assert.equal(stripeInvoiceToIsoMinor(100, currency), 1);
    assert.equal(stripeInvoiceToIsoMinor(2147483600, currency), 21474836);
    assert.equal(stripeInvoiceToIsoMinor(2147483647, currency), null);
  }
  assert.equal(stripeInvoiceToIsoMinor(21474836, 'MGA'), 2147483600);
  assert.equal(stripeInvoiceToIsoMinor(21474837, 'MGA'), null);
  assert.equal(stripeInvoiceToIsoMinor(2147483647, 'MGA'), null);
  assert.equal(stripeInvoiceToIsoMinor(2147483647, 'USD'), 2147483647);
  for (const raw of [
    0,
    -1,
    49.5,
    NaN,
    Infinity,
    2147483648,
    Number.MAX_SAFE_INTEGER,
  ])
    assert.equal(stripeInvoiceToIsoMinor(raw, 'USD'), null);
  for (const currency of ['usd', 'US', 'USD\n', 'USDD'])
    assert.equal(stripeInvoiceToIsoMinor(4900, currency), null);
});
