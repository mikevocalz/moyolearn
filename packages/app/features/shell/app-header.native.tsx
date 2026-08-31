'use client';
// Mobile app header — semantic `theme` prop, no raw hex. Wraps the same
// `@acme/ui` primitives the shell uses, so screens share the chrome contract.
// SOT: packages/theme/tokens.ts `moyo-*` primitives + `text-on-header`
// SOT-KEYWORDS: app header mobile shell chrome theme semantic header

import { SafeArea } from '@acme/ui';
import { Header } from '@acme/ui/primitives';
import { Text, View } from '@acme/ui/tw';
import type { AppHeaderProps } from './app-header.web';

export type { AppHeaderProps } from './app-header.web';

export function AppHeader({
  theme = 'lavender',
  title,
  leftSlot,
  rightSlot,
  hideStrip,
  className,
}: AppHeaderProps) {
  const background = `bg-moyo-${theme}`;

  return (
    <SafeArea edges={['top']} className={background}>
      <Header
        className={`flex-row items-center gap-stack border-b-2 border-border ${background} px-4 py-3 ${className ?? ''}`}
      >
        <View className="items-start justify-center">{leftSlot}</View>
        <Text className="flex-1 text-center text-lg font-semibold text-on-header md:text-xl">
          {title}
        </Text>
        <View className="items-end justify-center">{rightSlot}</View>
      </Header>
      {hideStrip ? null : <View className="h-1 bg-surface-accent" />}
    </SafeArea>
  );
}
