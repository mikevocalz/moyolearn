'use client';
// Entitlement state — the webhook's truth, projected once and read everywhere.
//
// Zustand and not React state because doc 06 §4 has this feeding `Stack.Protected`
// guards AND `PermissionGate` AND the S17 rail chip: three consumers at three
// depths, which is exactly the case a context re-render tax is paid for and a
// store is not.
// SOT: docs/pack/06-auth-onboarding-spec.md §4
// SOT-KEYWORDS: entitlements store zustand subscription status webhook gate

import { create } from 'zustand';
import type { SubscriptionState } from '@acme/auth';

interface EntitlementState {
  /** Every subscription this session can see: the guardian's, and each org's. */
  subscriptions: SubscriptionState[];
  /** Webhook truth arrives asynchronously; screens must not treat empty as "none". */
  loaded: boolean;
  setSubscriptions: (subscriptions: SubscriptionState[]) => void;
  reset: () => void;
}

export const useEntitlementStore = create<EntitlementState>((set) => ({
  subscriptions: [],
  loaded: false,
  setSubscriptions: (subscriptions) => set({ subscriptions, loaded: true }),
  reset: () => set({ subscriptions: [], loaded: false }),
}));
