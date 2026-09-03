'use client';
// Mobile app header — semantic `theme` prop, no raw hex and no raw primitive.
// Wraps the same `@acme/ui` primitives the shell uses, so screens share the
// chrome contract.
// SOT: packages/theme/tokens.ts `chromeTint` · ./chrome-classes.ts
// SOT-KEYWORDS: app header mobile shell chrome theme semantic header

import { SafeArea } from '@acme/ui';
import { Header } from '@acme/ui/primitives';
import { Text, View } from '@acme/ui/tw';
import { CHROME_CLASSES } from './chrome-classes';
import type { AppHeaderProps } from './app-header.web';

export type { AppHeaderProps } from './app-header.web';

export function AppHeader({
  theme = 'moyo-lavender',
  title,
  leftSlot,
  rightSlot,
  hideStrip,
  className,
}: AppHeaderProps) {
  // Ground and ink are read as ONE entry: a bar whose surface is picked in one
  // place and whose text colour is picked in another is how the shell ended up
  // painting body-coloured type on a chrome-coloured bar.
  const chrome = CHROME_CLASSES[theme];

  return (
    <SafeArea edges={['top']} className={chrome.surface}>
      <Header
        className={`flex-row items-center gap-stack border-b-2 border-border ${chrome.surface} px-4 py-3 ${className ?? ''}`}
      >
        <View className="items-start justify-center">{leftSlot}</View>
        <Text className={`flex-1 text-center text-lg font-semibold md:text-xl ${chrome.ink}`}>
          {title}
        </Text>
        <View className="items-end justify-center">{rightSlot}</View>
      </Header>
      {hideStrip ? null : <View className="h-1 bg-surface-accent" />}
    </SafeArea>
  );
}
