// Logo colour resolution. The SVG path fills in MoyoLearnLogo.tsx and
// MoyoLearnLogo.web.tsx were originally raw hexes. This helper maps them to
// the Moyo token palette and exposes single-colour variants for surfaces where
// the full-colour mark would clash.
// SOT: packages/theme/tokens.ts
// SOT-KEYWORDS: logo fill moyo brand variant single colour token

import { palette } from '@acme/theme';

export type LogoVariant = 'default' | 'dark' | 'light' | 'soft';

const DEFAULT_MAP: Record<string, keyof typeof palette> = {
  '#3C2357': 'moyo-purple',
  '#0A9FA6': 'moyo-teal',
  '#E55545': 'moyo-coral',
  '#ED6646': 'moyo-coral',
  '#F4A629': 'moyo-mango',
  '#FEFEFE': 'white',
};

const SOLID: Record<Exclude<LogoVariant, 'default'>, keyof typeof palette> = {
  dark: 'moyo-purple',
  light: 'white',
  soft: 'moyo-coral',
};

export function getLogoFill(hex: string, variant: LogoVariant = 'default'): string {
  if (variant === 'default') {
    const token = DEFAULT_MAP[hex.toUpperCase()];
    return token ? (palette[token] as string) : hex;
  }
  return palette[SOLID[variant]] as string;
}
