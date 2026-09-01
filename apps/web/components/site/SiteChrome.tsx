'use client';
// Site chrome — one public shell and one authenticated role shell per doc 36 §2.
// The `(site)` route group keeps its URLs while the chrome swaps: anon users see
// the branded site header+footer, authed users see the role shell for their
// active context. The resolved tenant CSS variables are injected by a single
// TenantScope that wraps whichever chrome renders.
// SOT: apps/web/components/site/SiteHeader.tsx · apps/web/components/site/SiteFooter.tsx
// SOT-KEYWORDS: site chrome marketing role shell public authenticated switch tenant

import { useMemo } from 'react';
import { View } from '@acme/ui/tw';
import { LoadingSkeleton, TenantScope } from '@acme/ui';
import { resolveTenantTheme, tenantCssVariables, useAppSession } from '@acme/app';
import type { OrgBranding } from '@acme/app';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';
import { RoleShell } from './RoleShell';

export interface SiteChromeProps {
  children: React.ReactNode;
  orgBranding?: OrgBranding | null;
}

export function SiteChrome({ children, orgBranding }: SiteChromeProps) {
  const { status } = useAppSession();

  const tenantVars = useMemo(() => {
    const brand = orgBranding ?? { name: 'Moyo' };
    return tenantCssVariables(resolveTenantTheme(brand, null));
  }, [orgBranding]);

  if (status === 'loading') {
    return (
      <TenantScope variables={tenantVars} className="flex-1">
        <View className="flex-1">
          <LoadingSkeleton count={6} className="m-inset" />
        </View>
      </TenantScope>
    );
  }

  if (status === 'anon') {
    return (
      <TenantScope variables={tenantVars} className="flex min-h-dvh flex-col">
        <SiteHeader orgBranding={orgBranding} />
        <View className="flex-1 pb-section">{children}</View>
        <SiteFooter />
      </TenantScope>
    );
  }

  return (
    <TenantScope variables={tenantVars} className="flex min-h-dvh flex-col">
      <RoleShell>{children}</RoleShell>
    </TenantScope>
  );
}
