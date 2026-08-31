'use client';
// Web anchor — app footers are owned by the web SiteFooter chrome, so this
// surface renders nothing when imported on web.
// SOT: apps/web/components/site/SiteFooter.tsx
// SOT-KEYWORDS: app footer web stub shell chrome site footer

export type AppFooterTheme =
  | 'lavender'
  | 'guava'
  | 'mint'
  | 'mango-pastel'
  | 'coral'
  | 'purple'
  | 'mango';

export interface AppFooterProps {
  theme?: AppFooterTheme;
  children?: React.ReactNode;
  className?: string;
}

export function AppFooter(_props: AppFooterProps) {
  return null;
}
