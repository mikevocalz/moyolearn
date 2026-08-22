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

const TEXT: Record<MessageFrom, string> = {
  tutor: 'font-sans text-body-lg text-text',
  child: 'font-sans text-body text-text',
};

export function MessageBubble({ from, children, className }: MessageBubbleProps) {
  return (
    <View
      className={`${ALIGN[from]} max-w-content-prose rounded-card border-2 border-strong bg-surface-raised p-inset-tight gap-stack ${className ?? ''}`}>
      <Text className={TEXT[from]}>{children}</Text>
    </View>
  );
}
