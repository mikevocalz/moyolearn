'use client';
// SessionToolbar — header for the S9 tutor session surface.
// SOT: docs/pack/23-tutorstage-handoff.md §4.1 · §8
// SOT-KEYWORDS: sessiontoolbar header tutor back captions tutor view

import { View, Text } from './primitives';
import { SafeArea } from './SafeArea';
import { IconButton } from './IconButton';
import { Button } from './Button';
import { ChevronLeft } from './icons';

export interface SessionToolbarProps {
  /** The session, not the tutor — `TutorPresence` names her (doc 23 §2). */
  title: string;
  captionsEnabled?: boolean;
  onBack?: () => void;
  onToggleCaptions?: () => void;
  className?: string;
}

/*
  THE PRESENCE CONTROL IS NOT HERE.

  It used to be: a text button cycling visible → compact → audio-only, wedged
  between the back chevron and the title. Three problems, all of them worse at
  phone width. Its label named a transition ("Make Natalie smaller") rather than
  a state, so it never told the child where she currently was; the cycle meant
  returning from voice-only cost two presses; and a long label in a three-slot
  header squeezed the session title out on a narrow screen.

  It now lives on the rail directly under Natalie (`TutorPresence`), which is
  both where the thing it controls is and where the status it reports belongs.
*/
export function SessionToolbar({
  title,
  captionsEnabled,
  onBack,
  onToggleCaptions,
  className,
}: SessionToolbarProps) {
  const hasRightAction = onToggleCaptions !== undefined;

  /*
    The top inset lives HERE, not in each caller. This is the first row of an
    immersive surface — the session hides the shell's own header — so without it
    the toolbar renders under the status bar and the whole screen reads as
    shifted up. `ShellHeader` already takes the same inset for the tabbed
    shells; a session must not be the one place chrome forgets. `SafeArea` is a
    plain passthrough on web, so this costs the web fork nothing.
  */
  return (
    <SafeArea edges={['top']} className="bg-surface">
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
            <Button
              title="CC"
              variant={captionsEnabled ? 'primary' : 'ghost'}
              size="sm"
              onPress={onToggleCaptions}
              aria-label="Toggle captions"
            />
          </View>
        ) : (
          <View className="h-10 w-10" />
        )}
      </View>
    </SafeArea>
  );
}
