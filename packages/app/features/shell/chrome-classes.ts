// The pastel -> utility-class table for chrome surfaces (AppHeader, AppFooter).
//
// Why a literal table and not `bg-chrome-${theme}`: Tailwind and Uniwind find
// classes by SCANNING SOURCE TEXT, so an interpolated class name is never
// generated and the surface renders unpainted. The shell chrome carried exactly
// that bug as `bg-moyo-${theme}` — which was also a raw PRIMITIVE, single-valued,
// so even when it resolved it painted a light bar in dark mode.
//
// Keyed on `ChromePastel`, so a fifth pastel added to `chromeTint` fails to
// typecheck here until it has classes — the table cannot silently fall behind
// the token system.
// SOT: packages/theme/tokens.ts `chromeTint`
// SOT-KEYWORDS: chrome classes pastel header footer surface tint scanner literal

import type { ChromePastel } from '@acme/theme';

export interface ChromeClasses {
  /** The bar's ground. */
  surface: string;
  /** The ink that ground carries, in both schemes. */
  ink: string;
}

export const CHROME_CLASSES = {
  'moyo-lavender': { surface: 'bg-chrome-lavender', ink: 'text-on-chrome-lavender' },
  'moyo-guava': { surface: 'bg-chrome-guava', ink: 'text-on-chrome-guava' },
  'moyo-mint': { surface: 'bg-chrome-mint', ink: 'text-on-chrome-mint' },
  'moyo-mango-pastel': { surface: 'bg-chrome-mango', ink: 'text-on-chrome-mango' },
} as const satisfies Record<ChromePastel, ChromeClasses>;
