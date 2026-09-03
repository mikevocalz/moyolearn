'use client';
// Web anchor — app footers are owned by the web SiteFooter chrome, so this
// surface renders nothing when imported on web.
// SOT: apps/web/components/site/SiteFooter.tsx · packages/theme/tokens.ts `chromeTint`
// SOT-KEYWORDS: app footer web stub shell chrome site footer

import type { ChromePastel } from '@acme/theme';

/** The four pastels a chrome surface may be — see `AppHeaderTheme`. */
export type AppFooterTheme = ChromePastel;

export interface AppFooterProps {
  theme?: AppFooterTheme;
  children?: React.ReactNode;
  className?: string;
}

export function AppFooter(_props: AppFooterProps) {
  return null;
}
