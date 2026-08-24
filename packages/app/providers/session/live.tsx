// LiveSessionProvider — resolves a real Better Auth session into the same store
// the mock provider writes to. Doc 09 §2 makes Wave 3 a provider swap, not a
// rewrite: nothing below the store changes, so no screen changes either.
// SOT: docs/pack/09-screens-first-build-order.md §2 · docs/pack/06-auth-onboarding-spec.md §2
// SOT-KEYWORDS: live session provider better auth wave3 membership context

import { useEffect } from 'react';
import { createMoyoAuthClient } from '@acme/auth';
import { useSessionStore } from './store';
import type { Membership, RoleKind } from './types';

const authClient = createMoyoAuthClient({
  baseURL:
    (typeof process !== 'undefined'
      ? process.env.EXPO_PUBLIC_AUTH_URL ?? process.env.NEXT_PUBLIC_AUTH_URL
      : undefined) ?? '',
});

/**
 * Better Auth stores the platform role on the organization membership, which is
 * where doc 06 §2 puts it. A user with no membership is a guardian: the family
 * shell is the one shell that exists without an org.
 */
function roleFromMemberships(memberships: Membership[]): RoleKind {
  return memberships[0]?.role ?? 'guardian';
}

export function LiveSessionProvider({ children }: { children: React.ReactNode }) {
  const { data, isPending } = authClient.useSession();
  const setPersona = useSessionStore((s) => s.setPersona);
  const setLoading = useSessionStore((s) => s.setLoading);

  useEffect(() => {
    if (isPending) {
      setLoading(true);
      return;
    }
    if (!data?.user) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      const orgs = await authClient.organization.list();
      if (cancelled) return;

      const memberships: Membership[] = (orgs.data ?? []).map((org) => ({
        id: org.id,
        orgId: org.id,
        orgName: org.name,
        // `role` rides the membership, not the org row; the org list carries it
        // only once the active org is set, so guardian is the safe floor.
        role: 'guardian' as RoleKind,
      }));

      setPersona({
        id: data.user.id,
        name: data.user.name,
        kind: roleFromMemberships(memberships),
        memberships,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [data, isPending, setPersona, setLoading]);

  return <>{children}</>;
}
