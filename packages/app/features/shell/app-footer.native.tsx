'use client';
// Mobile app footer — semantic `theme` prop, no raw hex. Bottom chrome for
// screens that need a stable branded surface outside the shell's tab bar.
// SOT: packages/theme/tokens.ts `moyo-*` primitives + `text-on-footer`
// SOT-KEYWORDS: app footer mobile shell chrome theme semantic footer

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View } from '@acme/ui/tw';
import type { AppFooterProps } from './app-footer.web';

export type { AppFooterProps } from './app-footer.web';

export function AppFooter({
  theme = 'mint',
  children,
  className,
}: AppFooterProps) {
  const insets = useSafeAreaInsets();
  const background = `bg-moyo-${theme}`;

  return (
    <View
      style={{ paddingBottom: insets.bottom }}
      className={`flex-row items-center border-t-2 border-border ${background} px-4 py-3 ${className ?? ''}`}
    >
      {children}
    </View>
  );
}
