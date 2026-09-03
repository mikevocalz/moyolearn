'use client';
// Mobile app footer — semantic `theme` prop, no raw hex and no raw primitive.
// Bottom chrome for screens that need a stable branded surface outside the
// shell's tab bar.
// SOT: packages/theme/tokens.ts `chromeTint` · ./chrome-classes.ts
// SOT-KEYWORDS: app footer mobile shell chrome theme semantic footer

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View } from '@acme/ui/tw';
import { CHROME_CLASSES } from './chrome-classes';
import type { AppFooterProps } from './app-footer.web';

export type { AppFooterProps } from './app-footer.web';

export function AppFooter({
  theme = 'moyo-mint',
  children,
  className,
}: AppFooterProps) {
  const insets = useSafeAreaInsets();
  const chrome = CHROME_CLASSES[theme];

  return (
    <View
      style={{ paddingBottom: insets.bottom }}
      className={`flex-row items-center border-t-2 border-border ${chrome.surface} px-4 py-3 ${className ?? ''}`}
    >
      {children}
    </View>
  );
}
