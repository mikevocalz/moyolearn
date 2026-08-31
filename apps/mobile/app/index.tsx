'use client';
import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import type { Href } from 'expo-router';
import {
  SHELL_ROOTS,
  availableRoles,
  getLastShellRole,
  membershipForRole,
  resolveBootRole,
  shellForRole,
  useAppSession,
  useSetContext,
} from '@acme/app';
import { View } from '@acme/ui/tw';

/**
 * The one login, five doors dispatcher (doc 36 §2). One role dispatches
 * straight to its shell; several roles go to the LAST-USED shell — never a
 * picker wall at login. The switcher for changing hats lives in Profile/You
 * (§4.3), and it writes the memory this reads.
 *
 * This route is also where §4.4's silent drop lands: +not-found redirects here,
 * so a role-mismatched deep link ends on the person's own landing screen with
 * no permission copy of any kind.
 */
export default function Dispatcher() {
  const session = useAppSession();
  const setContext = useSetContext();

  const bootRole =
    session.status === 'authed' ? resolveBootRole(session, getLastShellRole()) : null;
  const needsSwap = bootRole !== null && bootRole !== session.activeContext.kind;

  useEffect(() => {
    if (!needsSwap || bootRole === null) return;
    // Applied as an effect, not during render: the swap rewrites the store the
    // guard trees read, and every shell must observe it in the same commit.
    const membership = membershipForRole(session.memberships, bootRole);
    setContext({ kind: bootRole, orgId: membership?.orgId });
  }, [needsSwap, bootRole, session.memberships, setContext]);

  if (session.status === 'loading' || needsSwap) {
    return <View className="flex-1 bg-surface" />;
  }

  if (session.status === 'anon' || availableRoles(session).length === 0) {
    return <Redirect href="/onboarding" />;
  }

  const shell = shellForRole(session.activeContext.kind);
  if (!shell) return <Redirect href="/onboarding" />;
  return <Redirect href={SHELL_ROOTS[shell] as unknown as Href} />;
}
