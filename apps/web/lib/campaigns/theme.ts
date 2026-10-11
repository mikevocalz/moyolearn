// Email CSS cannot resolve app custom properties. Resolve the existing light
// semantic pairs once; do not introduce a second brand palette.
// SOT: packages/theme/tokens.ts
// SOT-KEYWORDS: business campaign email theme semantic tokens
import { semantic } from '@acme/theme';
export const emailTheme = {
  surface: semantic['surface-raised'].light,
  text: semantic.text.light,
  primary: semantic.primary.light,
  onPrimary: semantic['on-primary'].light,
} as const;
