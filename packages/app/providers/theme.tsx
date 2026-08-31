'use client';
// Shared tenant brand context. Resolution (server or client) feeds this
// boundary; components below it read `useResolvedBrand()` instead of fetching
// their own hexes. Mobile surfaces pass the resolved `theme` string to the
// semantic `AppHeader`/`AppFooter`; web surfaces set CSS variables at the layout.
// SOT: packages/app/core/tenant-brand.ts
// SOT-KEYWORDS: theme provider tenant brand resolved surface header footer

import { createContext, useContext } from 'react';
import type { ResolvedBrandTheme } from '../core/tenant-brand';

const BrandThemeContext = createContext<ResolvedBrandTheme | null>(null);

export interface ThemeProviderProps {
  value: ResolvedBrandTheme;
  children: React.ReactNode;
}

export function ThemeProvider({ value, children }: ThemeProviderProps) {
  return <BrandThemeContext value={value}>{children}</BrandThemeContext>;
}

export function useResolvedBrand(): ResolvedBrandTheme {
  const ctx = useContext(BrandThemeContext);
  if (!ctx) {
    // Fall back to the Moyo default so an unwrapped screen does not crash.
    return {
      header: 'moyo-lavender',
      footer: 'moyo-mint',
      action: 'moyo-purple',
      accent: 'moyo-coral',
    };
  }
  return ctx;
}
