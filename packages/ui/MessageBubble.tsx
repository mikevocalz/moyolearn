'use client';
// MessageBubble — a single turn in the tutoring conversation.
// SOT: docs/pack/23-tutorstage-handoff.md §3.2 · doc 15 §1
// SOT-KEYWORDS: messagebubble tutor child turn caption transcript

import type { ReactNode } from 'react';
import { View, Text } from './primitives';

export type MessageFrom = 'tutor' | 'child';

export interface MessageBubbleProps {
  from: MessageFrom;
  children: ReactNode;
  className?: string;
}

const ALIGN: Record<MessageFrom, string> = {
  tutor: 'self-start',
  child: 'self-end',
};

/*
  The tutor's turn is set a step above body. On a learner surface this line IS
  the instruction — a pre-reader is meant to be able to read (or follow along
  with) it, and at body size it was the smallest thing on a screen built for a
  child. `title` on the hot dial is 20px against body's 18.
*/
const TEXT: Record<MessageFrom, string> = {
  tutor: 'font-sans text-title text-text',
  child: 'font-sans text-body-lg text-text',
};

export function MessageBubble({ from, children, className }: MessageBubbleProps) {
  return (
    <View
      /*
        `rounded-control`, and this is the one place the dial does not get its
        way.

        `rounded-card` resolves to the DIAL's radius — 14px on a hot surface,
        which is what the tutor screen is. The composer directly beneath uses
        `control` at 6px, so one screen was speaking in two radii: a 14px bubble
        sitting on a 6px bar, which is exactly the mismatch that reads as
        sloppiness however defensible each half is on its own.

        The dial's chunkier radius is right for a card floating on a page. A
        chat bubble is not floating — it is stacked against the input, and
        adjacency is what makes a radius difference visible. Same reasoning that
        moved `TutorThread`'s bubbles; this is the live-turn bubble, which I
        missed because it lives in a different component.
      */
      className={`${ALIGN[from]} max-w-content-prose rounded-control border-2 border-strong bg-surface-raised p-inset-tight gap-stack ${className ?? ''}`}>
      <Text className={TEXT[from]}>{children}</Text>
    </View>
  );
}
