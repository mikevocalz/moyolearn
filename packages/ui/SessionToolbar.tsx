'use client';
// SessionToolbar — header for the S9 tutor session surface.
// SOT: docs/pack/23-tutorstage-handoff.md §4.1 · §8
// SOT-KEYWORDS: sessiontoolbar header tutor back captions tutor view

import { View, Text } from './primitives';
import { IconButton } from './IconButton';
import { Button } from './Button';
import { ChevronLeft } from './icons';
import type { TutorView } from './tutor-view';

export interface SessionToolbarProps {
  title: string;
  captionsEnabled?: boolean;
  tutorView?: TutorView;
  onBack?: () => void;
  onToggleCaptions?: () => void;
  onTutorViewChange?: (view: TutorView) => void;
  className?: string;
}

const VIEW_ACTION: Record<TutorView, { next: TutorView; label: string }> = {
  visible: { next: 'compact', label: 'Make Natalie smaller' },
  compact: { next: 'hidden', label: 'Hide Natalie' },
  hidden: { next: 'visible', label: 'Show Natalie' },
};

export function SessionToolbar({
  title,
  captionsEnabled,
  tutorView = 'compact',
  onBack,
  onToggleCaptions,
  onTutorViewChange,
  className,
}: SessionToolbarProps) {
  const hasRightAction = onToggleCaptions !== undefined || onTutorViewChange !== undefined;

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
      {hasRightAction ? (
        <View className="flex-row items-center gap-1">
          {onToggleCaptions ? (
            <Button
              title="CC"
              variant={captionsEnabled ? 'primary' : 'ghost'}
              size="sm"
              onPress={onToggleCaptions}
              aria-label="Toggle captions"
            />
          ) : null}
          {onTutorViewChange ? (
            <Button
              title={VIEW_ACTION[tutorView].label}
              variant="ghost"
              size="sm"
              onPress={() => onTutorViewChange(VIEW_ACTION[tutorView].next)}
              aria-label={VIEW_ACTION[tutorView].label}
            />
          ) : null}
        </View>
      ) : (
        <View className="h-10 w-10" />
      )}
    </View>
  );
}
