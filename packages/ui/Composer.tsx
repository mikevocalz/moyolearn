'use client';
// Composer — the learner message input for the S9 tutor session.
// Mobbin: https://mobbin.com/screens/9c13ada9-0c95-45c8-9932-d20010b96e14 (ChatGPT — field and trailing
// action share one row height) · https://mobbin.com/screens/5def00a9-6228-4ccc-81a3-25cdb2fe20bd (Pi —
// full-width field, single trailing send). Structure only.
// SOT: docs/pack/23-tutorstage-handoff.md §3.5 · doc 15 §1
// SOT-KEYWORDS: composer chat input tutor send message learner

import { useCallback } from 'react';
import { View, Textarea } from './primitives';
import { useAutoGrow } from './use-autogrow';
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
  // Grows with what is typed on web; a no-op on native, where the multiline
  // TextInput already does it.
  const { ref: fieldRef } = useAutoGrow(value);

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
      {/* A textarea top-aligns its text, so it must never be taller than its
          own content — otherwise a one-line answer sits against the top edge
          with a band of dead space beneath it. It carries no min-height and
          grows with what is typed; the FIELD sets the row height and the button
          follows it, rather than a 64px button stretching a 47px field. */}
      <Textarea
        ref={fieldRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        editable={!disabled}
        className="flex-1 resize-none overflow-y-auto rounded-control border-2 border-strong bg-surface-raised px-inset-tight py-inset-field font-sans text-body text-text placeholder:text-text-muted"
        numberOfLines={1}
        aria-label="Message composer"
      />
      {/* `min-h-0` + the field's own padding tier: the size scale's `py-4` made
          the button 64px, and with `items-stretch` that is what dragged the
          field out of shape. Same padding on both means both stay the same
          height without either one dictating a number. */}
      <Button
        title="Send"
        variant="primary"
        size={size}
        className="h-auto min-h-0 self-stretch py-inset-field md:py-inset-field"
        disabled={!canSend}
        onPress={handleSubmit}
        aria-label="Send message"
      />
    </View>
  );
}