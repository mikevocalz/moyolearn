// Plan display copy for the org Settings summary, paired to `PlanName` exactly
// as `PAYWALL_OFFERS` pairs S16's cards: the name a person reads and the name
// the server bills come from one key, so the summary cannot lie by drift.
// Prices are doc 05 §1.1's tier table as display copy — `PlanCard` stays
// data-props-only and no price is ever hardcoded in a component.
// SOT: docs/pack/05-monetization-access-spec.md §1.1 · design/screens/org/org.settings/contract.md
// SOT-KEYWORDS: org settings plan display copy price tier ops solo studio scale family

import type { PlanName } from '@acme/auth';

export interface PlanDisplay {
  title: string;
  /** e.g. `$99` — the monthly figure, for `PlanCard`'s price slot. */
  price: string;
  /** e.g. `/mo` — `PlanCard`'s period slot. */
  period: string;
}

/**
 * Exhaustive over `PlanName` (`as const satisfies`), so a plan added to the
 * catalogue without display copy fails the build here rather than rendering a
 * blank card. The family rows exist for that exhaustiveness — an org reference
 * only ever files ops plans, and this surface renders on the org shell only.
 */
export const PLAN_DISPLAY = {
  'family-early-bird': { title: 'Founding family', price: '$11', period: '/mo' },
  family: { title: 'Family', price: '$15.99', period: '/mo' },
  'ops-solo': { title: 'Ops · Solo', price: '$19', period: '/mo' },
  'ops-studio': { title: 'Ops · Studio', price: '$99', period: '/mo' },
  'ops-scale': { title: 'Ops · Scale', price: '$299', period: '/mo' },
} as const satisfies Record<PlanName, PlanDisplay>;

/** Long-form date so an owner reads "October 3, 2026", not an ISO string. */
export const formatPeriodDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
