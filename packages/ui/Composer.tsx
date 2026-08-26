'use client';
// Composer — the learner message input for the S9 tutor session.
// Mobbin: https://mobbin.com/screens/9c13ada9-0c95-45c8-9932-d20010b96e14 (ChatGPT — field and trailing
// action share one row height) · https://mobbin.com/screens/5def00a9-6228-4ccc-81a3-25cdb2fe20bd (Pi —
// full-width field, single trailing send). Structure only.
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
  /** Touch target comes from the age band, never a hardcoded size (CLAUDE.md §UI). */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function Composer({
  value,
  onChangeText,
  onSend,
  placeholder = 'Type your answer',
  disabled,
  size = 'md',
  className,
}: ComposerProps) {
  const canSend = !disabled && value.trim().length > 0;

  const handleSubmit = useCallback(() => {
    if (canSend) onSend();
  }, [canSend, onSend]);

  return (
    // `items-stretch` is what makes the field and the button the same height.
    // They size from two independent systems — the field from `min-h-target-*`
    // plus its padding, the button from its own size scale — so left to
    // themselves they disagree by a few pixels at every band. Stretching makes
    // the row the single source of height.
    <View className={`flex-row items-stretch gap-stack ${className ?? ''}`}>
      <Textarea
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        editable={!disabled}
        className="flex-1 rounded-control border-2 border-strong bg-surface-raised px-inset-tight py-inset-field font-sans text-body text-text placeholder:text-text-muted"
        numberOfLines={1}
        aria-label="Message composer"
        onSubmitEditing={handleSubmit}
      />
      <Button
        title="Send"
        variant="primary"
        size={size}
        className="h-auto self-stretch"
        disabled={!canSend}
        onPress={handleSubmit}
        aria-label="Send message"
      />
    </View>
  );
}