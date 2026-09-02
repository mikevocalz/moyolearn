'use client';
// BandGate — web permission fallback for band-excluded learner surfaces.
// Mobile deep-link-proofs off-band tabs with `href: null` per band
// (apps/mobile/app/(learner)/(tabs)/_layout.tsx BAND_ITEMS); web has no tab
// router, so a K–2 learner could open (site)/subjects — and, by the same law,
// young/child could open /progress — by typing the URL (C-orphans §Web
// dead-end fragments: "reachable by URL … no permission fallback"; G §3.1
// delta). The allowlist is DERIVED from HOT_NAV_LEARNER_BY_BAND — the same
// rows the shell renders — so nav and gate cannot drift: a surface is in-band
// iff its href appears in the band's nav list. Non-learner contexts pass
// through untouched (guardian/tutor legitimately view these pages). Off-band
// learners are replaced to '/' — silent drop, matching mobile's href:null and
// doc 36 §4's role-mismatch law — and the loading state renders RoleShell's
// LoadingSkeleton pattern so off-band content never flashes.
// SOT: docs/design/overhaul-v2/C-orphans-dead-ends.md §Web dead-end fragments ·
//      docs/design/overhaul-v2/G-navigation-maps.md §3.1 ·
//      docs/pack/36-role-navigation-flows.md §3.1
// SOT-KEYWORDS: band gate permission fallback learner surface url deep link guard subjects progress

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'solito/navigation';
import { useAppSession } from '@acme/app';
import { LoadingSkeleton } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { HOT_NAV_LEARNER_BY_BAND } from './nav';
import type { AgeBand } from './nav';

/** The band-gated learner surfaces — the two hrefs doc 36 §3.1 withholds from
 * younger bands (young lacks both; child lacks /progress). The other learner
 * hrefs ('/', '/capture', '/practice') appear in every band's nav, so gating
 * them would be dead code. */
export type GatedSurface = '/subjects' | '/progress';

// In-band iff the band's own nav renders the surface — one decision drives
// both what the chrome shows and what a URL can open.
const bandAllows = (band: AgeBand, surface: GatedSurface) =>
  HOT_NAV_LEARNER_BY_BAND[band].some((item) => item.href === surface);

export function BandGate({
  surface,
  children,
}: {
  surface: GatedSurface;
  children: ReactNode;
}) {
  const { status, activeContext } = useAppSession();
  const router = useRouter();

  // Band fallback mirrors RoleShell and the mobile tab layout: no band reads
  // as teen (which carries every surface, so the gate stays open).
  const offBand =
    status === 'authed' &&
    activeContext.kind === 'learner' &&
    !bandAllows(activeContext.gradeBand ?? 'teen', surface);

  useEffect(() => {
    // replace, not push: the off-band URL must not survive in history for the
    // back button to resurface (mobile's href:null leaves no trace either).
    if (offBand) router.replace('/');
  }, [offBand, router]);

  if (status === 'loading' || offBand) {
    return (
      <View className="flex-1">
        <LoadingSkeleton count={6} className="m-inset" />
      </View>
    );
  }

  return <>{children}</>;
}
