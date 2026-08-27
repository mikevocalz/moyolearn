'use client';
// The signal that makes `loaded` true. `setSubscriptions` existed with no caller
// for as long as the store did, which left `loaded` permanently false and every
// gate resolving on its unloaded branch — the whole reason paid features were
// reachable without a plan.
//
// It follows the session STORE rather than a provider effect because the dev
// role switcher writes the store directly (`RoleSwitcher` → `setPersona`), so a
// provider-mount effect would leave entitlements pinned to whichever persona
// booted first.
//
// Plain effect + fetch, not TanStack Query, for a mount-order reason: web puts
// `SessionProvider` OUTSIDE `AppQueryProvider` and native puts it inside, so a
// component living here cannot assume a QueryClient exists. Its output is a
// Zustand store rather than component state, which is the part of the repo's
// rule that actually matters here.
// SOT: docs/pack/06-auth-onboarding-spec.md §4
// SOT-KEYWORDS: entitlements sync subscriptions store loaded session persona fetch webhook

import { useEffect } from 'react';
import { PERSONAS } from '../../fixtures/personas';
import { mockSubscriptionsFor } from '../../fixtures/subscriptions';
import { getAuthMode } from '../session/auth-mode';
import { useSessionStore } from '../session/store';
import { fetchEntitlements } from './entitlements.client';
import { useEntitlementStore } from './store';

export function EntitlementsSync() {
  const userId = useSessionStore((s) => s.user?.id);
  const status = useSessionStore((s) => s.status);
  const setSubscriptions = useEntitlementStore((s) => s.setSubscriptions);
  const reset = useEntitlementStore((s) => s.reset);

  useEffect(() => {
    // A session still resolving is the one state where nothing is known, and
    // `loaded: false` is how the gates are told so.
    if (status === 'loading') {
      reset();
      return;
    }

    /*
      Signed out is an ANSWER, not an absence: nobody has a plan. Loading it as
      an empty list lets a marketing or sign-in surface resolve its gates
      immediately instead of sitting in the unknown state waiting for a webhook
      that is never coming for a visitor.
    */
    if (status === 'anon' || !userId) {
      setSubscriptions([]);
      return;
    }

    if (getAuthMode() === 'mock') {
      const persona = PERSONAS.find((p) => p.id === userId);
      if (persona) {
        setSubscriptions(mockSubscriptionsFor(persona));
        return;
      }
    }

    const controller = new AbortController();
    /*
      A failed read leaves the store UNLOADED rather than writing an empty list.
      Empty means "we asked and there is no plan", which on a paying customer's
      screen is a false statement that outlives the request; unknown is true and
      resolves the moment the next read succeeds. Either way the operation
      behind the feature is refused by the server, so nothing is granted here.
    */
    void fetchEntitlements(controller.signal)
      .then(setSubscriptions)
      .catch(() => undefined);
    return () => controller.abort();
  }, [userId, status, setSubscriptions, reset]);

  return null;
}
