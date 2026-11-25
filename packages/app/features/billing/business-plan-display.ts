// Display copy for the ops tiers, in one place. The org Settings summary and the
// S17 convert screen both read from here, so Solo/Studio/Scale have one title
// and one price across the org shell.
//
// Deliberately NOT in `@acme/auth/plan-catalog`: that file is what a parent may
// be shown, and doc 05 §2.2 keeps business tiers off every parent surface. A
// module a guardian screen never imports is the simplest form of that rule.
//
// These figures are doc 05 §1.1's tier table. moyolearn.com publishes no
// business price ("talk to us"), so unlike the consumer catalogue they have no
// public page of record to be checked against.
// SOT: docs/pack/05-monetization-access-spec.md §1.1 · §2.2
// SOT-KEYWORDS: business plan display ops solo studio scale price title org settings convert

import { formatUsd, type BusinessPlanName } from '@acme/auth';

export interface BusinessPlanDisplay {
  title: string;
  /** Short form for the convert screen's card. */
  shortTitle: string;
  monthlyCents: number;
}

/**
 * Exhaustive over `BusinessPlanName` (`as const satisfies`), so an ops tier
 * added to the catalogue without display copy fails the build here rather than
 * rendering a blank card.
 */
export const BUSINESS_PLAN_DISPLAY = {
  'ops-solo': { title: 'Ops · Solo', shortTitle: 'Solo', monthlyCents: 19_00 },
  'ops-studio': { title: 'Ops · Studio', shortTitle: 'Studio', monthlyCents: 99_00 },
  'ops-scale': { title: 'Ops · Scale', shortTitle: 'Scale', monthlyCents: 299_00 },
} as const satisfies Record<BusinessPlanName, BusinessPlanDisplay>;

/** `$99` */
export const businessMonthlyPrice = (plan: BusinessPlanName): string =>
  formatUsd(BUSINESS_PLAN_DISPLAY[plan].monthlyCents);

/** `$99/month` */
export const businessMonthlyPriceLine = (plan: BusinessPlanName): string =>
  `${businessMonthlyPrice(plan)}/month`;
