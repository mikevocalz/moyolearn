// The wire between the entitlement route and the entitlement store.
//
// The response shape is declared HERE and the route imports it as a type, so the
// projection the client reads and the projection the server writes are one
// definition (doc 11 §2). It is deliberately the same `SubscriptionState[]` the
// server gate judges against: two shapes would be two policies.
// SOT: docs/pack/06-auth-onboarding-spec.md §4 · docs/pack/11-architectural-guardrails.md §2
// SOT-KEYWORDS: entitlements client fetch subscriptions api response type store

import type { SubscriptionState } from '@acme/auth';
import { API_URL } from '../../core/api-url.ts';

export interface EntitlementsResponse {
  /** Every reference the caller can hold a plan under: themselves, plus their orgs. */
  subscriptions: SubscriptionState[];
}

export async function fetchEntitlements(signal?: AbortSignal): Promise<SubscriptionState[]> {
  const res = await fetch(`${API_URL}/api/entitlements`, { credentials: 'include', signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return ((await res.json()) as EntitlementsResponse).subscriptions;
}
