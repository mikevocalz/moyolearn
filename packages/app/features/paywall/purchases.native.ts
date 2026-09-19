'use client';
// Native store purchases use the same adult Better Auth id as Stripe imports.
// Serialize identity changes with purchases: a shared-device switch must never
// change the RevenueCat customer while a store purchase sheet is in flight.
// SOT: https://www.revenuecat.com/docs/customers/identifying-customers
// SOT-KEYWORDS: revenuecat native purchases identity restore paywall billing
import { Linking, Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { FAMILY_ENTITLEMENT } from '@acme/auth';
import { useSessionStore } from '../../providers/session/store';
import { fetchBillingState } from '../../providers/entitlements/entitlements.client';
import { useEntitlementStore } from '../../providers/entitlements/store';
import { assertBillingUser, confirmFamilyAccess, requireBillingUser, stripeBillingPortal } from './billing-actions';

const apiKey = Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
  : Platform.OS === 'android' ? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY : undefined;
let queue: Promise<void> = Promise.resolve();

function serialize<T>(action: () => Promise<T>): Promise<T> {
  const result = queue.then(action);
  queue = result.then(() => undefined, () => undefined);
  return result;
}

async function identify(userId: string | null) {
  if (!apiKey) throw new Error('Subscriptions are not available yet. You can continue with free practice.');
  if (!await Purchases.isConfigured()) {
    if (userId) Purchases.configure({ apiKey, appUserID: userId, automaticDeviceIdentifierCollectionEnabled: false });
    return;
  }
  if (!userId) {
    if (!await Purchases.isAnonymous()) await Purchases.logOut();
  } else if (await Purchases.getAppUserID() !== userId) {
    await Purchases.logIn(userId);
  }
}

export function syncPurchaseIdentity(userId: string | null) {
  return serialize(async () => {
    const session = useSessionStore.getState();
    const current = session.status === 'authed' && session.user?.kind !== 'learner'
      && session.activeContext.kind !== 'learner' ? session.user?.id ?? null : null;
    if (current === userId) await identify(userId);
  });
}

async function withPurchases<T>(action: () => Promise<T>) {
  return serialize(async () => {
    const userId = await requireBillingUser();
    const state = await fetchBillingState();
    if (!state.revenueCatEnabled) throw new Error('Subscriptions are not available yet. You can continue with free practice.');
    assertBillingUser(userId);
    await identify(userId);
    assertBillingUser(userId);
    const result = await action();
    assertBillingUser(userId);
    useEntitlementStore.getState().refresh();
    return result;
  });
}

export async function purchaseFamily() {
  return withPurchases(async () => {
    // The store paywall supplies localized prices and actual trial eligibility.
    // Imported Stripe entitlements also suppress a second subscription here.
    const result = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: FAMILY_ENTITLEMENT,
      displayCloseButton: true,
    });
    if (result === PAYWALL_RESULT.CANCELLED) return false;
    if (result === PAYWALL_RESULT.ERROR) throw new Error('The purchase could not be completed. Please try again.');
    if (!await confirmFamilyAccess()) {
      throw new Error('Your purchase is still being confirmed. Restore purchases to check again.');
    }
    return true;
  });
}

export async function restoreFamilyPurchases() {
  return withPurchases(async () => {
    await Purchases.restorePurchases();
    if (!await confirmFamilyAccess()) throw new Error('No active family subscription was found for this account.');
    return true;
  });
}

export const canRestorePurchases = true;

export async function manageFamilySubscription() {
  await withPurchases(async () => {
    const customer = await Purchases.getCustomerInfo();
    const url = customer.managementURL ?? await stripeBillingPortal('https://app.moyolearn.com/settings');
    if (new URL(url).protocol !== 'https:') throw new Error('The subscription management link is unavailable.');
    await Linking.openURL(url);
  });
}
