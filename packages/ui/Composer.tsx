'use client';
// Composer — the learner message input for the S9 tutor session.
// SOT: docs/pack/23-tutorstage-handoff.md §3.5 · doc 15 §1
// SOT-KEYWORDS: composer chat input tutor send message learner

import { useCallback } from 'react';
import { View, Textarea } from './primitives';
import { Button } from './Button';

export interface ComposerProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function Composer({
  value,
  onChangeText,
  onSend,
  placeholder = 'Type your answer',
  disabled,
  className,
}: ComposerProps) {
  const canSend = !disabled && value.trim().length > 0;

  const handleSubmit = useCallback(() => {
    if (canSend) onSend();
  }, [canSend, onSend]);

  return (
    <View className={`flex-row gap-stack ${className ?? ''}`}>
      <Textarea
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        editable={!disabled}
        className="min-h-target-adult flex-1 rounded-card border-2 border-strong bg-surface-raised p-inset-tight font-sans text-body text-text placeholder:text-text-muted"
        numberOfLines={1}
        aria-label="Message composer"
        onSubmitEditing={handleSubmit}
      />
      <Button
        title="Send"
        variant="primary"
        size="md"
        disabled={!canSend}
        onPress={handleSubmit}
        aria-label="Send message"
      />
    </View>
  );
}