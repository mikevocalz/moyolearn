// Tenant theme normalization. Every tenant — Moyo, district, school, or
// tutoring business — resolves to the same CSS-variable shape, so the web shell
// draws from one source of truth and admin controls one data model.
// SOT: packages/theme/tokens.ts · packages/payload/src/collections/Organizations.ts
// SOT-KEYWORDS: tenant theme brand resolve contrast css variables shell

import { palette, roleTheme, type AccentRole } from '@acme/theme';

export interface TenantBrand {
  name: string;
  logoUrl?: string;
  logoAspect?: 'square' | 'wide';
  brandTheme?: string;
  brandAccent?: string;
}

export interface ResolvedTenantTheme {
  name: string;
  logoUrl?: string;
  logoAspect?: 'square' | 'wide';
  primary: string;
  primaryHover: string;
  primaryForeground: string;
  header: string;
  headerForeground: string;
  headerMuted: string;
  headerBorder: string;
  sidebar: string;
  sidebarForeground: string;
  sidebarMuted: string;
  sidebarActive: string;
  sidebarActiveForeground: string;
  sidebarActiveIndicator: string;
  accent: string;
  accentHover: string;
  accentForeground: string;
  surface: string;
  surfaceSubtle: string;
  border: string;
  focusRing: string;
  success: string;
  warning: string;
  danger: string;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const normalized = hex.trim().toLowerCase();
  if (normalized.startsWith('#')) {
    const h = normalized.slice(1);
    const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
    if (full.length !== 6) return null;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as [number, number, number];
  }
  const m = normalized.match(/rgba?\(([^)]+)\)/i);
  if (!m) return null;
  const parts = m[1]!.split(',').map((n) => parseFloat(n.trim()));
  return [parts[0]! / 255, parts[1]! / 255, parts[2]! / 255];
}

function relativeLuminance(rgb: [number, number, number]): number {
  const mapped = rgb.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * mapped[0]! + 0.7152 * mapped[1]! + 0.0722 * mapped[2]!;
}

function contrastRatio(a: string, b: string): number | null {
  const aRgb = hexToRgb(a);
  const bRgb = hexToRgb(b);
  if (!aRgb || !bRgb) return null;
  const lumA = relativeLuminance(aRgb);
  const lumB = relativeLuminance(bRgb);
  const l1 = Math.max(lumA, lumB);
  const l2 = Math.min(lumA, lumB);
  return (l1 + 0.05) / (l2 + 0.05);
}

export function accessibleForeground(background: string): string {
  const black = palette.ink[950];
  const white = palette.white;
  const blackRatio = contrastRatio(background, black);
  const whiteRatio = contrastRatio(background, white);
  if (blackRatio === null || whiteRatio === null) return black;
  return blackRatio >= whiteRatio ? black : white;
}

function moyoHeaderForeground(): string {
  return palette['moyo-purple'];
}

function headerForegroundFor(header: string, isMoyo: boolean): string {
  if (isMoyo) return moyoHeaderForeground();
  return accessibleForeground(header);
}

const MOYO_SURFACE = {
  lavender: 'moyo-lavender',
  guava: 'moyo-guava',
  mint: 'moyo-mint',
  'mango-pastel': 'moyo-mango-pastel',
} as const;

function isMoyoSurface(value: string): value is keyof typeof MOYO_SURFACE {
  return value in MOYO_SURFACE;
}

function headerFor(brand: TenantBrand, role: AccentRole | null): string {
  if (brand.brandTheme && isMoyoSurface(brand.brandTheme)) {
    return palette[MOYO_SURFACE[brand.brandTheme]] as string;
  }
  if (role && role in roleTheme) {
    const key = roleTheme[role].surfaceHeader as keyof typeof palette;
    return palette[key] as string;
  }
  return palette['moyo-lavender'] as string;
}

function headerBorderFor(header: string, foreground: string): string {
  const light = accessibleForeground(header) === palette.ink[950];
  return light ? 'rgba(13, 12, 11, 0.10)' : 'rgba(255, 253, 247, 0.15)';
}

const ACCENT_SCALES = new Set(['ember', 'gold', 'forest', 'sky', 'rose']);

function isAccentScale(value: string | undefined): value is 'ember' | 'gold' | 'forest' | 'sky' | 'rose' {
  return value !== undefined && ACCENT_SCALES.has(value);
}

function accentFor(brand: TenantBrand): { primary: string; primaryHover: string; accent: string; accentHover: string } {
  if (isAccentScale(brand.brandAccent)) {
    return {
      primary: palette[brand.brandAccent][600],
      primaryHover: palette[brand.brandAccent][700],
      accent: palette[brand.brandAccent][500],
      accentHover: palette[brand.brandAccent][600],
    };
  }
  return {
    primary: palette['moyo-purple'],
    primaryHover: palette['moyo-purple'],
    accent: palette['moyo-coral'],
    accentHover: palette['moyo-coral'],
  };
}

export function resolveTenantTheme(brand: TenantBrand, role: AccentRole | null = null): ResolvedTenantTheme {
  const header = headerFor(brand, role);
  const isMoyoHeader = brand.brandTheme ? isMoyoSurface(brand.brandTheme) : role !== null;
  const headerForeground = headerForegroundFor(header, isMoyoHeader);
  const headerMuted = `${headerForeground}B3`;
  const { primary, primaryHover, accent, accentHover } = accentFor(brand);

  const sidebarActive = accent;
  const sidebarActiveForeground = accessibleForeground(sidebarActive);

  return {
    name: brand.name,
    logoUrl: brand.logoUrl,
    logoAspect: brand.logoAspect,
    primary,
    primaryHover,
    primaryForeground: accessibleForeground(primary),
    header,
    headerForeground,
    headerMuted,
    headerBorder: headerBorderFor(header, headerForeground),
    sidebar: palette.ink[50],
    sidebarForeground: palette.ink[950],
    sidebarMuted: palette.ink[600],
    sidebarActive,
    sidebarActiveForeground,
    sidebarActiveIndicator: accent,
    accent,
    accentHover,
    accentForeground: accessibleForeground(accent),
    surface: palette.ink[50],
    surfaceSubtle: palette.ink[100],
    border: palette.ink[950],
    focusRing: accent,
    success: palette.forest[600],
    warning: palette['moyo-mango'],
    danger: palette.rose[600],
  };
}

export function tenantCssVariables(theme: ResolvedTenantTheme): Record<string, string> {
  return {
    '--color-tenant-primary': theme.primary,
    '--color-tenant-primary-hover': theme.primaryHover,
    '--color-tenant-primary-foreground': theme.primaryForeground,
    '--color-tenant-header': theme.header,
    '--color-tenant-header-foreground': theme.headerForeground,
    '--color-tenant-header-muted': theme.headerMuted,
    '--color-tenant-header-border': theme.headerBorder,
    '--color-tenant-sidebar': theme.sidebar,
    '--color-tenant-sidebar-foreground': theme.sidebarForeground,
    '--color-tenant-sidebar-muted': theme.sidebarMuted,
    '--color-tenant-sidebar-active': theme.sidebarActive,
    '--color-tenant-sidebar-active-foreground': theme.sidebarActiveForeground,
    '--color-tenant-sidebar-active-indicator': theme.sidebarActiveIndicator,
    '--color-tenant-accent': theme.accent,
    '--color-tenant-accent-hover': theme.accentHover,
    '--color-tenant-accent-foreground': theme.accentForeground,
    '--color-tenant-surface': theme.surface,
    '--color-tenant-surface-subtle': theme.surfaceSubtle,
    '--color-tenant-border': theme.border,
    '--color-tenant-focus-ring': theme.focusRing,
    '--color-tenant-success': theme.success,
    '--color-tenant-warning': theme.warning,
    '--color-tenant-danger': theme.danger,
  };
}
