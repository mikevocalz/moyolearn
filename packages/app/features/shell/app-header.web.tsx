'use client';
// Web anchor — app headers are owned by the web SiteHeader chrome, so this
// surface renders nothing when imported on web.
// SOT: apps/web/components/site/SiteChrome.tsx
// SOT-KEYWORDS: app header web stub shell chrome site header

export type AppHeaderTheme =
  | 'lavender'
  | 'guava'
  | 'mint'
  | 'mango-pastel'
  | 'coral'
  | 'purple'
  | 'mango';

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
