'use client';
// Session provider barrel — picks mock or live by auth mode.
// SOT: docs/pack/09-screens-first-build-order.md §2
// SOT-KEYWORDS: session provider barrel mock live use appsession

import { useShallow } from 'zustand/react/shallow';
import { MockSessionProvider } from './mock';
import { LiveSessionProvider } from './live';
import { getAuthMode } from './auth-mode';
import { useSessionStore } from './store';
import type { AppSession } from './types';
import { EntitlementsSync } from '../entitlements/entitlements-sync';

export type { RoleKind, ActiveContext, ActiveContextKind, AppSession, AppUser, Membership } from './types';
export { RoleSwitcher } from './role-switcher';

/**
 * `EntitlementsSync` is mounted HERE rather than in each app's layout. There are
 * five layouts across web and native that mount a session, and an entitlement
 * store that four of them fill is a store that silently grants or hides features
 * depending on which shell you entered through. A session and the plans attached
 * to it arrive together or the pair is a bug.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const Provider = getAuthMode() === 'live' ? LiveSessionProvider : MockSessionProvider;
  return (
    <Provider>
      <EntitlementsSync />
      {children}
    </Provider>
  );
}

export function useAppSession(): AppSession {
  // zustand v5 compares snapshots with Object.is, so a selector building a fresh
  // object every call makes React re-render forever. useShallow is the fix.
  return useSessionStore(
    useShallow((s) => ({
      user: s.user,
      activeContext: s.activeContext,
      memberships: s.memberships,
      status: s.status,
    })),
  );
}

export function useSetContext() {
  return useSessionStore((s) => s.setContext);
}
