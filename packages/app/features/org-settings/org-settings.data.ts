// Org Settings display helpers. Plan titles and prices come from
// `../billing/business-plan-display`, shared with the convert screen; this file
// keeps only what is specific to the settings summary.
// SOT: design/screens/org/org.settings/contract.md
// SOT-KEYWORDS: org settings plan display date format

/** Long-form date so an owner reads "October 3, 2026", not an ISO string. */
export const formatPeriodDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
