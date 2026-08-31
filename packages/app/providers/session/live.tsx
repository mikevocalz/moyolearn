'use client';
// LiveSessionProvider — resolves a real Better Auth session into the same store
// the mock provider writes to. Doc 09 §2 makes Wave 3 a provider swap, not a
// rewrite: nothing below the store changes, so no screen changes either.
//
// The organization list from Better Auth does not carry the per-member role,
// so we call `getFullOrganization` for each org to read the member row. The
// member row is the source of truth; the client does not supply the role.
// SOT: docs/pack/09-screens-first-build-order.md §2 · docs/pack/06-auth-onboarding-spec.md §2
// SOT-KEYWORDS: live session provider better auth wave3 membership context role education

import { useEffect } from 'react';
import { isMembershipRole } from '@acme/auth/membership';
import { createMoyoAuthClient } from '@acme/auth';
import { betterAuthCookieStorage } from '@acme/secure';
import { useSessionStore } from './store';
import { isRoleKind, roleForOrganizationRole } from './role-mapping';
import type { Membership, RoleKind } from './types';

export const authClient = createMoyoAuthClient({
  baseURL:
    (typeof process !== 'undefined'
      ? process.env.EXPO_PUBLIC_AUTH_URL ?? process.env.NEXT_PUBLIC_AUTH_URL
      : undefined) ?? '',
  storage: betterAuthCookieStorage,
  scheme: 'moyo',
});

type FullOrgMember = {
  userId?: string;
  user?: { id?: string };
  role?: string;
  educationRole?: string | null;
};

function primaryEducationRole(memberships: Membership[]): RoleKind {
  return memberships[0]?.role ?? 'guardian';
}

function memberEducationRole(member: FullOrgMember): RoleKind {
  if (isRoleKind(member.educationRole ?? undefined)) return member.educationRole as RoleKind;
  const orgRole = member.role ?? undefined;
  if (isMembershipRole(orgRole)) {
    return roleForOrganizationRole(orgRole) ?? 'guardian';
  }
  return 'guardian';
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

    const user = data.user;
    let cancelled = false;
    void (async () => {
      const orgs = await authClient.organization.list();
      if (cancelled) return;

      const fullResults = await Promise.all(
        (orgs.data ?? []).map((org) =>
          authClient.organization.getFullOrganization({
            query: { organizationId: org.id },
          }),
        ),
      );
      if (cancelled) return;

      const memberships: Membership[] = (orgs.data ?? []).map((org, index) => {
        const full = fullResults[index]?.data;
        const member = (full?.members ?? [] as FullOrgMember[]).find(
          (m) => (m.userId ?? m.user?.id) === user.id,
        );
        const role = member ? memberEducationRole(member) : 'guardian';
        const organizationRole = (() => {
          if (!member) return undefined;
          const raw = member.role ?? undefined;
          return isMembershipRole(raw) ? raw : undefined;
        })();
        return {
          id: org.id,
          orgId: org.id,
          orgName: org.name,
          role,
          organizationRole,
        } satisfies Membership;
      });

      setPersona({
        id: user.id,
        name: user.name,
        kind: primaryEducationRole(memberships),
        memberships,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [data, isPending, setPersona, setLoading]);

  return <>{children}</>;
}
