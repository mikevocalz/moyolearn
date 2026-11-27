// Stripe invoice amounts stay unchanged in the private payment journal.
// SOT: docs/site/signaliq-business-connection.md · https://docs.stripe.com/currencies
// ISO units: https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml
// SOT-KEYWORDS: marketing payment stripe iso minor units exact conversion
export const MAX_MARKETING_PAYMENT_MINOR = 2_147_483_647;

/**
 * Convert the Stripe invoice representation to the ISO minor units used by a
 * Signal order. This is a unit conversion, never a currency exchange or rounding.
 * ISK/UGX keep two compatibility digits at Stripe but ISO uses zero; Stripe
 * charges MGA in whole ariary while ISO uses two digits. HUF/TWD's special
 * payout rules do not apply to paid invoices. Other invoice units are unchanged.
 */
export function stripeInvoiceToIsoMinor(
  stripeAmountMinor: number,
  currency: string,
): number | null {
  if (
    !Number.isSafeInteger(stripeAmountMinor) ||
    stripeAmountMinor <= 0 ||
    stripeAmountMinor > MAX_MARKETING_PAYMENT_MINOR ||
    currency.length !== 3 ||
    !/^[A-Z]{3}$/.test(currency)
  )
    return null;
  const converted =
    currency === 'ISK' || currency === 'UGX'
      ? stripeAmountMinor / 100
      : currency === 'MGA'
        ? stripeAmountMinor * 100
        : stripeAmountMinor;
  return Number.isSafeInteger(converted) &&
    converted > 0 &&
    converted <= MAX_MARKETING_PAYMENT_MINOR
    ? converted
    : null;
}
