'use client';
// Web anchor — app headers are owned by the web SiteHeader chrome, so this
// surface renders nothing when imported on web.
// SOT: apps/web/components/site/SiteChrome.tsx · packages/theme/tokens.ts `chromeTint`
// SOT-KEYWORDS: app header web stub shell chrome site header

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
