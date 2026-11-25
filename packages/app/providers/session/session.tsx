'use client';
// Session provider barrel — picks mock or live by auth mode.
// SOT: docs/pack/09-screens-first-build-order.md §2
// SOT-KEYWORDS: session provider barrel mock live use appsession dev require release bundle

import type { ComponentType, ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { LiveSessionProvider } from './live';
import { getAuthMode } from './auth-mode';
import { useSessionStore } from './store';
import type { AppSession } from './types';
import { EntitlementsSync } from '../entitlements/entitlements-sync';

export type { RoleKind, ActiveContext, ActiveContextKind, AppSession, AppUser, Membership } from './types';
export { RoleSwitcher } from './role-switcher';

type SessionProviderComponent = ComponentType<{ children: ReactNode }>;

/**
 * The mock provider is loaded only inside a development build, and through
 * `require` behind a literal `__DEV__` test rather than a static import.
 *
 * A static import put `MockSessionProvider` and every fixture persona into the
 * release bundle, where `getAuthMode()` never selected it but a reverse of the
 * binary still found eleven ready-made identities. Metro inlines `__DEV__` and
 * drops the dead branch together with the module it required; the test is
 * written out here, not read through `isDevBuild()`, because only a literal
 * folds. On Next `__DEV__` is undefined and `NODE_ENV` is the inlined signal.
 *
 * In a release build this returns the live provider whatever the env said —
 * `getAuthMode()` already answers `live` there, so the two agree.
 */
function resolveProvider(): SessionProviderComponent {
  if (getAuthMode() === 'live') return LiveSessionProvider;
  const devBuild =
    typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV === 'development';
  if (devBuild) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mock = require('./mock') as typeof import('./mock');
    return mock.MockSessionProvider;
  }
  return LiveSessionProvider;
}

/**
 * `EntitlementsSync` is mounted HERE rather than in each app's layout. There are
 * five layouts across web and native that mount a session, and an entitlement
 * store that four of them fill is a store that silently grants or hides features
 * depending on which shell you entered through. A session and the plans attached
 * to it arrive together or the pair is a bug.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const Provider = resolveProvider();
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
