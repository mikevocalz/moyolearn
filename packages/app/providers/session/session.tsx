'use client';
// Session provider barrel — picks mock or live by auth mode.
// SOT: docs/pack/09-screens-first-build-order.md §2
// SOT-KEYWORDS: session provider barrel mock live use appsession

import { useShallow } from 'zustand/react/shallow';
import { MockSessionProvider } from './mock';
import { LiveSessionProvider } from './live';
import { useSessionStore } from './store';
import type { AppSession } from './types';

export type { RoleKind, ActiveContext, ActiveContextKind, AppSession, AppUser, Membership } from './types';
export { RoleSwitcher } from './role-switcher';

function getAuthMode() {
  const env =
    typeof process !== 'undefined'
      ? process.env.EXPO_PUBLIC_AUTH_MODE ?? process.env.NEXT_PUBLIC_AUTH_MODE
      : undefined;
  if (env === 'live' || env === 'mock') return env;
  return 'mock';
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const mode = getAuthMode();
  const Provider = mode === 'live' ? LiveSessionProvider : MockSessionProvider;
  return <Provider>{children}</Provider>;
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
