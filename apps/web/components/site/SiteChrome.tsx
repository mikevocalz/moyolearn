'use client';
// Site chrome — one public shell and one authenticated role shell per doc 36 §2.
// The `(site)` route group keeps its URLs while the chrome swaps: anon users see
// the branded site header+footer, authed users see the role shell for their
// active context. Theme resolution lives in the `(site)` layout, not here.
// SOT: apps/web/components/site/SiteHeader.tsx · apps/web/components/site/SiteFooter.tsx
// SOT-KEYWORDS: site chrome marketing role shell public authenticated switch

import { View } from '@acme/ui/tw';
import { LoadingSkeleton } from '@acme/ui';
import { useAppSession } from '@acme/app';
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

  if (status === 'loading') {
    return (
      <View className="flex-1">
        <LoadingSkeleton count={6} className="m-inset" />
      </View>
    );
  }

  if (status === 'anon') {
    return (
      <>
        <SiteHeader orgBranding={orgBranding} />
        <View className="flex-1 pb-section">{children}</View>
        <SiteFooter />
      </>
    );
  }

  return <RoleShell>{children}</RoleShell>;
}
