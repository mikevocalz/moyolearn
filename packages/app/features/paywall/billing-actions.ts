'use client';
// Billing actions share the live session and the server entitlement projection.
// A checkout redirect or a client purchase result alone never grants access.
// SOT: docs/pack/06-auth-onboarding-spec.md §4
// SOT-KEYWORDS: billing checkout portal family confirmation adult session
import { entitlementsFor, subscriptionFor, type PlanName } from '@acme/auth';
import { authClient } from '../../providers/session/live';
import { getAuthMode } from '../../providers/session/auth-mode';
import { useSessionStore } from '../../providers/session/store';
import { fetchBillingState } from '../../providers/entitlements/entitlements.client';
import { useEntitlementStore } from '../../providers/entitlements/store';

export async function requireBillingUser() {
  if (getAuthMode() !== 'live') throw new Error('Sign in to manage your subscription.');
  const { data, error } = await authClient.getSession();
  if (error || !data?.user) throw new Error('Sign in to manage your subscription.');
  const user = data.user;
  if (('guardianManaged' in user && user.guardianManaged === true)
    || ('isMinor' in user && user.isMinor === true)
    || useSessionStore.getState().activeContext.kind === 'learner') {
    throw new Error('Billing is available to adults only.');
  }
  assertBillingUser(user.id);
  return user.id;
}

export function assertBillingUser(userId: string) {
  const session = useSessionStore.getState();
  if (session.status !== 'authed' || session.user?.id !== userId
    || session.activeContext.kind === 'learner') {
    throw new Error('Your account changed. Please try again.');
  }
}

export async function confirmFamilyAccess() {
  const userId = await requireBillingUser();
  const state = await fetchBillingState();
  assertBillingUser(userId);
  const subscription = subscriptionFor(state.subscriptions, userId);
  useEntitlementStore.getState().refresh();
  return (subscription.plan === 'family' || subscription.plan === 'family-early-bird')
    && entitlementsFor(subscription).active;
}

export async function startFamilyCheckout(plan: PlanName) {
  const userId = await requireBillingUser();
  if (plan !== 'family' && plan !== 'family-early-bird') throw new Error('Choose a family plan.');
  if (await confirmFamilyAccess()) return 'active' as const;
  assertBillingUser(userId);
  const success = new URL(window.location.href);
  success.searchParams.set('checkout', 'success');
  const cancel = new URL(window.location.href);
  cancel.searchParams.delete('checkout');
  const { data, error } = await authClient.subscription.upgrade({
    plan,
    customerType: 'user',
    successUrl: success.href,
    cancelUrl: cancel.href,
    returnUrl: cancel.href,
    disableRedirect: true,
  });
  if (error || !data?.url) throw new Error(error?.message ?? 'Checkout could not be opened. Please try again.');
  assertBillingUser(userId);
  window.location.assign(data.url);
  return 'redirecting' as const;
}

export async function stripeBillingPortal(returnUrl: string) {
  const userId = await requireBillingUser();
  const { data, error } = await authClient.subscription.billingPortal({
    customerType: 'user', returnUrl, disableRedirect: true,
  });
  if (error || !data?.url) throw new Error(error?.message ?? 'No web subscription is available to manage.');
  assertBillingUser(userId);
  return data.url;
}
