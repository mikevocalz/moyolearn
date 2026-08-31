// Tenant brand normalization. Co-branding is a TOKEN NAME, never a raw hex.
// This module is the single place where an organization's chosen theme is
// validated and mapped to the Moyo semantic palette, so both web and mobile
// resolve the same values from the same inputs.
// SOT: packages/theme/tokens.ts `moyo-*` primitives · packages/payload/src/collections/Organizations.ts `brandTheme`
// SOT-KEYWORDS: tenant brand theme surface moyo co-branding validate resolve

import { roleTheme, type AccentRole } from '@acme/theme';

export type MoyoSurface =
  | 'moyo-lavender'
  | 'moyo-guava'
  | 'moyo-mint'
  | 'moyo-mango-pastel';

export type MoyoBrand =
  | 'moyo-purple'
  | 'moyo-coral'
  | 'moyo-teal'
  | 'moyo-mango';

export interface ResolvedBrandTheme {
  /** Pastel surface for large chrome areas (header, welcome band). */
  header: MoyoSurface;
  /** Pastel surface for bottom chrome (tab bar, action bar). */
  footer: MoyoSurface;
  /** Primary action fill. */
  action: MoyoBrand;
  /** Small accent / header strip. */
  accent: MoyoBrand;
}

const ALLOWED_SURFACES: readonly string[] = [
  'moyo-lavender',
  'moyo-guava',
  'moyo-mint',
  'moyo-mango-pastel',
];

const DEFAULTS: ResolvedBrandTheme = {
  header: 'moyo-lavender',
  footer: 'moyo-mint',
  action: 'moyo-purple',
  accent: 'moyo-coral',
} as const;

/**
 * Accept only the curated Moyo surface token names. Anything else falls through
 * so the next fallback in the chain can answer.
 */
function sanitizeSurface(value: unknown): MoyoSurface | null {
  if (typeof value !== 'string') return null;
  const v = value.toLowerCase().trim();
  return ALLOWED_SURFACES.includes(v) ? (v as MoyoSurface) : null;
}

/**
 * Resolution order:
 * 1. explicit tenant `brandTheme` if it passes the allowlist;
 * 2. the active role's Moyo default pastel;
 * 3. the global Moyo lavender fallback.
 */
export function resolveTenantTheme(
  brandTheme: unknown,
  role: AccentRole | null = null,
): ResolvedBrandTheme {
  const roleHeader =
    role && role in roleTheme
      ? (roleTheme[role].surfaceHeader as MoyoSurface)
      : DEFAULTS.header;

  return {
    header: sanitizeSurface(brandTheme) ?? roleHeader,
    footer: DEFAULTS.footer,
    action: DEFAULTS.action,
    accent: DEFAULTS.accent,
  };
}
