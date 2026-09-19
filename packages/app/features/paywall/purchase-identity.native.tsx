'use client';
// Keep RevenueCat identity aligned across sign-in, sign-out, and shared devices.
// SOT: https://www.revenuecat.com/docs/customers/identifying-customers
// SOT-KEYWORDS: revenuecat identity session sync native shared device
import { useEffect } from 'react';
import Purchases from 'react-native-purchases';
import { getAuthMode } from '../../providers/session/auth-mode';
import { useSessionStore } from '../../providers/session/store';
import { useEntitlementStore } from '../../providers/entitlements/store';
import { syncPurchaseIdentity } from './purchases.native';

export function PurchaseIdentity() {
  const status = useSessionStore((s) => s.status);
  const user = useSessionStore((s) => s.user);
  const kind = useSessionStore((s) => s.activeContext.kind);
  const refresh = useEntitlementStore((s) => s.refresh);
  const userId = status === 'authed' && user?.kind !== 'learner' && kind !== 'learner' ? user?.id ?? null : null;
  useEffect(() => {
    if (getAuthMode() !== 'live') return;
    // The purchase action reports any configuration error to the adult. A
    // billing service outage must not block a child's ordinary app session.
    void syncPurchaseIdentity(userId).catch(() => undefined);
  }, [userId]);
  useEffect(() => {
    if (getAuthMode() !== 'live') return;
    Purchases.addCustomerInfoUpdateListener(refresh);
    return () => { Purchases.removeCustomerInfoUpdateListener(refresh); };
  }, [refresh]);
  return null;
}
