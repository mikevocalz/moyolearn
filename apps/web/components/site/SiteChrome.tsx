'use client';
// Site chrome — one public shell and one authenticated role shell per doc 36 §2.
// The `(site)` route group keeps its URLs while the chrome swaps: anon users see
// the marketing header+footer, authed users see the role shell for their active
// context. This is the layout-level split that replaces the overloaded
// `SiteHeader`.
// SOT: apps/web/components/site/MarketingHeader.tsx · apps/web/components/site/RoleShell.tsx
// SOT-KEYWORDS: site chrome marketing role shell public authenticated switch

import { View } from '@acme/ui/tw';
import { LoadingSkeleton } from '@acme/ui';
import { useAppSession } from '@acme/app';
import { MarketingHeader } from './MarketingHeader';
import { SiteFooter } from './SiteFooter';
import { RoleShell } from './RoleShell';

export function SiteChrome({ children }: { children: React.ReactNode }) {
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
        <MarketingHeader />
        <View className="flex-1 pb-section">{children}</View>
        <SiteFooter />
      </>
    );
  }

  return <RoleShell>{children}</RoleShell>;
}
