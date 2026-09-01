'use client';
// SessionToolbar — header for the S9 tutor session surface.
// SOT: docs/pack/23-tutorstage-handoff.md §4.1 · §8
// SOT-KEYWORDS: sessiontoolbar header tutor back captions tutor view

import { View, Text } from './primitives';
import { IconButton } from './IconButton';
import { Button } from './Button';
import { ChevronLeft } from './icons';
import type { TutorPresencePreference } from './tutor-view';

export interface SessionToolbarProps {
  title: string;
  captionsEnabled?: boolean;
  tutorPresence?: TutorPresencePreference;
  onBack?: () => void;
  onToggleCaptions?: () => void;
  onTutorPresenceChange?: (presence: TutorPresencePreference) => void;
  className?: string;
}

const PRESENCE_ACTION: Record<
  Exclude<TutorPresencePreference, 'auto'>,
  { next: Exclude<TutorPresencePreference, 'auto'>; label: string }
> = {
  visible: { next: 'compact', label: 'Make Natalie smaller' },
  compact: { next: 'audio-only', label: 'Voice only' },
  'audio-only': { next: 'visible', label: 'Show Natalie' },
};

export function SessionToolbar({
  title,
  captionsEnabled,
  tutorPresence = 'compact',
  onBack,
  onToggleCaptions,
  onTutorPresenceChange,
  className,
}: SessionToolbarProps) {
  const hasRightAction = onToggleCaptions !== undefined || onTutorPresenceChange !== undefined;

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
          {onTutorPresenceChange && tutorPresence !== 'auto' ? (
            <Button
              title={PRESENCE_ACTION[tutorPresence].label}
              variant="ghost"
              size="sm"
              onPress={() => onTutorPresenceChange(PRESENCE_ACTION[tutorPresence].next)}
              aria-label={PRESENCE_ACTION[tutorPresence].label}
            />
          ) : null}
        </View>
      ) : (
        <View className="h-10 w-10" />
      )}
    </View>
  );
}
