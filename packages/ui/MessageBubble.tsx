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
  tutor: 'font-sans text-title text-on-chrome-lavender',
  child: 'font-sans text-body-lg text-text',
};

/*
  The tutor's bubble is a TINTED surface with no input-weight border; the
  child's keeps the bordered card.

  Natalie's turn used the same recipe as `TextField`'s input — `rounded-md` /
  `rounded-control` are the same value, both carried `border-2` on
  `bg-surface-raised` — so her opening line on the learner home was, pixel for
  pixel, a text field. A child (and an adult tester) tapped it and tried to
  type into a sentence. `surface-ai` is the palette's existing "this is the AI
  speaking" tint, which makes her voice recognisably hers and structurally
  unlike anywhere you can type.
*/
const SURFACE: Record<MessageFrom, string> = {
  tutor: 'rounded-card bg-surface-ai p-inset-tight',
  child: 'rounded-control border-2 border-strong bg-surface-raised p-inset-tight',
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
      className={`${ALIGN[from]} max-w-content-prose gap-stack ${SURFACE[from]} ${className ?? ''}`}>
      <Text className={TEXT[from]}>{children}</Text>
    </View>
  );
}
