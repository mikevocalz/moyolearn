'use client';
// Site chrome — the app-domain shell per doc 36 §2. Authed users get the role
// shell for their active context; anon users get bare content (the auth
// doorway) — marketing header/footer live on www.moyolearn.com, never here.
// SOT: apps/web/components/site/RoleShell.tsx
// SOT-KEYWORDS: site chrome marketing role shell public authenticated switch tenant

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { View } from '@acme/ui/tw';
import { LoadingSkeleton, TenantScope } from '@acme/ui';
import { resolveTenantTheme, tenantCssVariables, useAppSession } from '@acme/app';
import type { OrgBranding } from '@acme/app';
import { RoleShell } from './RoleShell';

export interface SiteChromeProps {
  children: React.ReactNode;
  orgBranding?: OrgBranding | null;
}

/*
  Surfaces that own the whole screen AND must never wait on the session gate
  below: a live session carries its own toolbar (doc 07 — a lesson is a bounded
  place); a /share report is read by a tokened outsider who cannot pass an auth
  handshake; and the auth doorway itself must not depend on the answer it
  exists to obtain. Gating /login on the session left it rendering the loading
  skeleton forever whenever the session never resolved — a sign-in page that
  cannot be reached until you are signed in.
*/
const CHROMELESS_PREFIXES = ['/tutor', '/share', '/login', '/onboarding', '/handoff'];

export function SiteChrome({ children, orgBranding }: SiteChromeProps) {
  const { status } = useAppSession();
  const pathname = usePathname();

  const tenantVars = useMemo(() => {
    const brand = orgBranding ?? { name: 'Moyo' };
    return tenantCssVariables(resolveTenantTheme(brand, null));
  }, [orgBranding]);

  if (CHROMELESS_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return (
      <TenantScope variables={tenantVars} className="flex min-h-dvh flex-1 flex-col">
        {children}
      </TenantScope>
    );
  }

  if (status === 'loading') {
    return (
      <TenantScope variables={tenantVars} className="flex-1">
        <View className="flex-1">
          <LoadingSkeleton count={6} className="m-inset" />
        </View>
      </TenantScope>
    );
  }

  // Anon on the app domain is only ever the auth doorway — marketing chrome
  // (header pill, footer) belongs to www.moyolearn.com, never here.
  if (status === 'anon') {
    return (
      <TenantScope variables={tenantVars} className="flex min-h-dvh flex-1 flex-col">
        {children}
      </TenantScope>
    );
  }

  return (
    <TenantScope variables={tenantVars} className="flex min-h-dvh flex-col">
      <RoleShell>{children}</RoleShell>
    </TenantScope>
  );
}
