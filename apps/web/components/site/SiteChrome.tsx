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

/**
 * Surfaces that OWN the viewport instead of growing past it.
 *
 * `min-h-dvh` is a floor, not a ceiling, so a column under it grows to its
 * content — and on the tutor session the content is a conversation. The
 * measured result before this existed: a `/tutor` document 9123px tall in a
 * 900px window, with the whole page scrolling, the thread's own virtual
 * scroller never bounded so it rendered every turn, the composer somewhere past
 * the fold, and Natalie's WebGPU canvas asked for a 1124×17958 texture — which
 * exceeds the 8192 device limit, so her renderer failed with hundreds of
 * validation errors on every session. `TutorStage`'s own note ("the
 * conversation is the whole screen and should own it") describes the intent
 * that this line is what actually enforces.
 *
 * A separate list rather than changing the chromeless branch outright: `/login`
 * and `/onboarding` are documents and are supposed to scroll. Only a surface
 * whose panes do their own scrolling may be capped.
 */
const ONE_SCREEN_PREFIXES = ['/tutor'];

export function SiteChrome({ children, orgBranding }: SiteChromeProps) {
  const { status } = useAppSession();
  const pathname = usePathname();

  const tenantVars = useMemo(() => {
    const brand = orgBranding ?? { name: 'Moyo' };
    return tenantCssVariables(resolveTenantTheme(brand, null));
  }, [orgBranding]);

  const matches = (prefixes: readonly string[]) =>
    prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (matches(CHROMELESS_PREFIXES)) {
    return (
      <TenantScope
        variables={tenantVars}
        /*
          `h-dvh` WITHOUT `flex-1`, and the omission is the load-bearing half.
          As a growing flex item this element resolves its height from its
          content no matter what `height` says, so `flex-1 h-dvh` measured 9123px
          in a 900px window — the exact bug it was added to fix. Dropped from the
          flex line it takes the viewport as an explicit box and clips, and the
          panes inside scroll themselves.
        */
        className={`flex flex-col ${
          matches(ONE_SCREEN_PREFIXES) ? 'h-dvh overflow-hidden' : 'min-h-dvh flex-1'
        }`}
      >
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
