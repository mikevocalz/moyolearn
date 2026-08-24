'use client';
// The hook every gate goes through. It resolves WHICH subscription applies from
// the active context — an ops screen reads the org's, a family screen the
// guardian's — because reading the wrong one is how a guardian's lapsed card
// locks an unrelated organisation out.
// SOT: docs/pack/06-auth-onboarding-spec.md §4
// SOT-KEYWORDS: entitlements hook capability context org guardian subscription

import { useMemo } from 'react';
import {
  can,
  daysLeft,
  entitlementsFor,
  subscriptionFor,
  type Capability,
  type Entitlements,
  type SubscriptionState,
} from '@acme/auth';
import { useAppSession } from '../session';
import { useEntitlementStore } from './store';

export interface ResolvedEntitlements {
  entitlements: Entitlements;
  subscription: SubscriptionState;
  /** Null until the webhook truth has arrived, or when there is no period. */
  daysLeft: number | null;
  loaded: boolean;
  can: (capability: Capability) => boolean;
}

export function useEntitlements(): ResolvedEntitlements {
  const { user, activeContext } = useAppSession();
  const subscriptions = useEntitlementStore((s) => s.subscriptions);
  const loaded = useEntitlementStore((s) => s.loaded);

  return useMemo(() => {
    // Ops contexts bill to the org; everything else bills to the person.
    const referenceId = activeContext.orgId ?? user?.id ?? null;
    const subscription = subscriptionFor(subscriptions, referenceId);
    const entitlements = entitlementsFor(subscription);
    return {
      entitlements,
      subscription,
      daysLeft: daysLeft(subscription),
      loaded,
      can: (capability: Capability) => can(entitlements, capability),
    };
  }, [activeContext.orgId, user?.id, subscriptions, loaded]);
}
