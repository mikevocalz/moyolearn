'use client';
// SessionToolbar — header for the S9 tutor session surface.
// SOT: docs/pack/23-tutorstage-handoff.md §4.1 · §8
// SOT-KEYWORDS: sessiontoolbar header tutor back captions

import { View, Text } from './primitives';
import { IconButton } from './IconButton';
import { Button } from './Button';
import { ChevronLeft } from './icons';

export interface SessionToolbarProps {
  title: string;
  captionsEnabled?: boolean;
  onBack?: () => void;
  onToggleCaptions?: () => void;
  className?: string;
}

export function SessionToolbar({
  title,
  captionsEnabled,
  onBack,
  onToggleCaptions,
  className,
}: SessionToolbarProps) {
  return (
    <View
      className={`flex-row items-center justify-between border-b-2 border-strong p-inset-tight ${className ?? ''}`}>
      <IconButton
        icon={<ChevronLeft className="h-5 w-5" />}
        aria-label="Back"
        onPress={onBack}
        variant="ghost"
        size="md"
      />
      <Text className="max-w-content-prose truncate font-sans text-title font-bold text-text">
        {title}
      </Text>
      {onToggleCaptions ? (
        <Button
          title="CC"
          variant={captionsEnabled ? 'primary' : 'ghost'}
          size="sm"
          onPress={onToggleCaptions}
          aria-label="Toggle captions"
        />
      ) : (
        <View className="h-10 w-10" />
      )}
    </View>
  );
}