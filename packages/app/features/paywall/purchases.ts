'use client';
// Web management stays in Stripe; mobile restores are provided by the native fork.
// SOT: docs/pack/06-auth-onboarding-spec.md §4
// SOT-KEYWORDS: billing web stripe portal management restore
import { subscriptionFor } from '@acme/auth';
import { fetchBillingState } from '../../providers/entitlements/entitlements.client';
import { assertBillingUser, requireBillingUser, stripeBillingPortal } from './billing-actions';

export const canRestorePurchases = false;

export async function manageFamilySubscription() {
  const userId = await requireBillingUser();
  const state = await fetchBillingState();
  const managementUrl = subscriptionFor(state.subscriptions, userId).managementUrl;
  const url = managementUrl ?? await stripeBillingPortal(window.location.href);
  assertBillingUser(userId);
  if (new URL(url).protocol !== 'https:') throw new Error('The subscription management link is unavailable.');
  window.location.assign(url);
}

export async function restoreFamilyPurchases(): Promise<boolean> {
  throw new Error('Restore purchases in the Moyo mobile app.');
}
