'use client';
// The anchor for both platforms — app headers are owned by the chrome, so this
// surface renders nothing. On web that is the SiteHeader; on native it is
// `apps/mobile/components/ShellHeader.tsx`, which every routed screen's bar goes
// through.
//
// There WAS a `.native.tsx` fork here that drew a second bar in a second dialect
// — centred title, `border-border` instead of the `on-surface-header` pair, a
// decorative accent strip under it — with zero call sites. It is deleted: a
// dead rival header is how a shell ends up with two chromes, and CLAUDE.md's
// "never invent a second way" is the rule it was standing on. `AppHeaderTheme`
// stays because `tenant-brand` reads the same pastel names.
// SOT: apps/web/components/site/SiteChrome.tsx ·
//      apps/mobile/components/ShellHeader.tsx · packages/theme/tokens.ts `chromeTint`
// SOT-KEYWORDS: app header web stub shell chrome site header one dialect

import type { ChromePastel } from '@acme/theme';

/**
 * The four pastels a chrome surface may be, straight off the token system.
 *
 * It used to be a hand-written union of seven short names ('lavender', plus
 * 'coral' | 'purple' | 'mango', which are BRAND marks and were never valid
 * grounds for a bar). Two costs: three of the seven had no chrome pair to
 * resolve to, and `useResolvedBrand().header` — typed `MoyoSurface`, the same
 * four values in their full spelling — could not be handed to this prop even
 * though the provider exists to do exactly that. One spelling, derived.
 */
export type AppHeaderTheme = ChromePastel;

export interface AppHeaderProps {
  theme?: AppHeaderTheme;
  title?: string;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  hideStrip?: boolean;
  className?: string;
}

export function AppHeader(_props: AppHeaderProps) {
  return null;
}
