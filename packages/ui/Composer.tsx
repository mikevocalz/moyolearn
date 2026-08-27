'use client';
// Composer — the learner message input for the S9 tutor session.
//
// Mobbin: https://mobbin.com/screens/9c13ada9-0c95-45c8-9932-d20010b96e14 (ChatGPT — field and trailing action share one row height) · https://mobbin.com/screens/5def00a9-6228-4ccc-81a3-25cdb2fe20bd (Pi — full-width field, single trailing send) · https://mobbin.com/screens/236da9c6-8b17-4989-ad40-7e0da07ef603 (Noom — Camera / Photo library / Files, one flat list, no submenus) · https://mobbin.com/screens/db352f6d-4d7d-41f1-a678-e66ee043da83 (BFF — the same list including "Record audio message") · https://mobbin.com/screens/1d54bc84-03b2-4f46-8bca-3c6574ac07e1 (Instagram — recording REPLACES the field: live waveform, discard left, send right) · https://mobbin.com/screens/66e343b2-3334-4d2b-9494-bc22ce3cf386 (Beside — same shape, timer beside the waveform) · https://mobbin.com/screens/c827a5e4-3507-4bf7-a570-63bf1224752d (Alan — a sent voice note carries "See transcript"). Structure only.
//
// A child stuck on homework points a camera at it rather than describing it, so
// the composer takes pictures, documents and speech, not only typing.
//
// Three structural decisions, all taken from the references rather than
// invented:
//
//  - ONE flat attachment list. Every app above offers Camera / Photos / Files
//    at the top level. A child hunting through a submenu for "the photo one"
//    has already lost the thread of the problem they were stuck on.
//  - Recording REPLACES the field rather than sitting beside it. While speaking
//    there is nothing to type, and a live waveform where the text was is what
//    tells a child the microphone is actually hearing them.
//  - Discard is on the far side from send. They are opposite intentions and a
//    mis-tap costs the whole message, so they do not sit next to each other.
// SOT: docs/pack/23-tutorstage-handoff.md §3.5 · doc 15 §1
// SOT-KEYWORDS: composer chat input tutor send message learner

import { useCallback } from 'react';
import { View, Text, Pressable, Textarea } from './primitives';
import { useAutoGrow } from './use-autogrow';
import { Button } from './Button';
import { Camera, FileUp, Image, Mic, Plus, Trash2, X } from './icons';
import type { TutorAttachment } from './tutor-attachment.ts';

export interface ComposerProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  placeholder?: string;
  disabled?: boolean;
  /** Touch target comes from the age band, never a hardcoded size (CLAUDE.md §UI). */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /**
   * Attachments staged for the next turn. Rendered above the field so a child
   * can see what they are about to send — and remove it — before it goes.
   */
  attachments?: readonly TutorAttachment[];
  onRemoveAttachment?: (id: string) => void;
  /**
   * Offered only when the host supplies a handler. Missing handler, missing
   * button: the same rule the capability registry uses, so a control never
   * appears where the platform cannot honour it.
   */
  onPickCamera?: () => void;
  onPickImage?: () => void;
  onPickDocument?: () => void;
  /** Starts a voice turn. Absent on web until MediaRecorder is wired. */
  onStartRecording?: () => void;
  /** Live recording state, owned by the host. */
  recording?: { elapsedSec: number; levels: readonly number[] };
  onCancelRecording?: () => void;
  onSendRecording?: () => void;
  className?: string;
}

export function Composer({
  value,
  onChangeText,
  onSend,
  placeholder = 'Type your answer',
  disabled,
  size = 'md',
  attachments,
  onRemoveAttachment,
  onPickCamera,
  onPickImage,
  onPickDocument,
  onStartRecording,
  recording,
  onCancelRecording,
  onSendRecording,
  className,
}: ComposerProps) {
  /*
    An attachment is a message. A photo of a maths problem with no words is the
    commonest thing a stuck child sends, and requiring them to type something
    alongside it would be a toll booth on the exact moment they are struggling.
  */
  const canSend = !disabled && (value.trim().length > 0 || (attachments?.length ?? 0) > 0);
  const canAttach = !disabled && (onPickCamera ?? onPickImage ?? onPickDocument) !== undefined;
  // Grows with what is typed. The two platforms use different mechanisms —
  // `scrollHeight` on web, `onContentSizeChange` on native — so the hook returns
  // props to spread rather than a single ref.
  const autoGrow = useAutoGrow(value);

  const handleSubmit = useCallback(() => {
    if (canSend) onSend();
  }, [canSend, onSend]);

  /*
    Recording replaces the row entirely — see the header. While a child is
    speaking there is nothing to type, and the waveform standing where the field
    was is what proves the microphone is hearing them.
  */
  if (recording) {
    return (
      <View className={`flex-row items-center gap-stack ${className ?? ''}`}>
        <Pressable
          onPress={onCancelRecording}
          aria-label="Discard recording"
          className="h-target-md w-target-md items-center justify-center rounded-control border-2 border-strong bg-surface-raised"
        >
          <Trash2 size={20} className="text-danger" />
        </Pressable>

        <View className="flex-1 flex-row items-center gap-element rounded-control border-2 border-strong bg-surface-raised px-inset-tight py-inset-field">
          {/* Live level meter. Bars, not a spinner: a spinner says "busy", and
              what a child needs to know is "it can hear me". */}
          <View className="flex-1 flex-row items-end gap-0.5" aria-label="Recording">
            {recording.levels.slice(-32).map((level, i) => (
              <View
                key={i}
                className="flex-1 rounded-full bg-danger"
                style={{ height: `${Math.max(12, Math.min(100, level * 100))}%` }}
              />
            ))}
          </View>
          {/* Mono so the seconds do not shift the waveform as they tick. */}
          <Text className="font-mono text-data text-text-muted">
            {Math.floor(recording.elapsedSec / 60)}:
            {String(Math.floor(recording.elapsedSec % 60)).padStart(2, '0')}
          </Text>
        </View>

        <Button
          title="Send"
          variant="primary"
          size={size}
          className="h-auto min-h-0 self-stretch py-inset-field md:py-inset-field"
          onPress={onSendRecording}
          aria-label="Send voice message"
        />
      </View>
    );
  }

  return (
    <View className={`gap-stack ${className ?? ''}`}>
      {/* Staged attachments, above the field. A child should see what is about
          to be sent while there is still time to take it back. */}
      {attachments && attachments.length > 0 ? (
        <View className="flex-row flex-wrap gap-element">
          {attachments.map((attachment) => (
            <View
              key={attachment.id}
              className="flex-row items-center gap-element rounded-control border-2 border-border bg-surface-raised py-1 pl-inset-tight pr-1"
            >
              {attachment.kind === 'image' ? <Image size={16} className="text-text-muted" /> : null}
              {attachment.kind === 'document' ? <FileUp size={16} className="text-text-muted" /> : null}
              {attachment.kind === 'audio' ? <Mic size={16} className="text-text-muted" /> : null}
              {/* Truncated, never wrapped: a long filename should not push the
                  field down the screen while a child is mid-thought. */}
              <Text numberOfLines={1} className="max-w-40 font-sans text-caption text-text">
                {attachment.name}
              </Text>
              <Pressable
                onPress={() => onRemoveAttachment?.(attachment.id)}
                aria-label={`Remove ${attachment.name}`}
                className="h-target-sm w-target-sm items-center justify-center rounded-control"
              >
                <X size={14} className="text-text-muted" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {/* `items-stretch` is what makes the field and the actions one height.
          They size from independent systems — the field from its padding, the
          button from its own scale — so left alone they disagree by a few
          pixels at every band. Stretching makes the row the source of height. */}
      <View className="flex-row items-stretch gap-stack">
        {/* Attach, leading. One flat list behind it, never a submenu — see the
            header. Hidden entirely when the host supplies no picker. */}
        {canAttach ? (
          <Pressable
            onPress={onPickCamera ?? onPickImage ?? onPickDocument}
            aria-label="Add a photo or file"
            className="w-target-md items-center justify-center rounded-control border-2 border-strong bg-surface-raised"
          >
            <Plus size={20} className="text-text" />
          </Pressable>
        ) : null}

        {/* A textarea top-aligns its text, so it must never be taller than its
            own content — otherwise a one-line answer sits against the top edge
            with dead space beneath. It carries no min-height and grows with what
            is typed; the FIELD sets the row height and the actions follow. */}
        <Textarea
          {...autoGrow}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          editable={!disabled}
          className="flex-1 resize-none overflow-y-auto rounded-control border-2 border-strong bg-surface-raised px-inset-tight py-inset-field font-sans text-body text-text placeholder:text-text-muted"
          numberOfLines={1}
          aria-label="Message composer"
        />

        {/*
          Speak or send, never both. An empty field offers the microphone,
          because a child who has typed nothing is likelier to want to talk; the
          moment there is something to send, sending is the only thing that
          button should do. Swapping in place rather than showing two buttons
          keeps one action under the thumb at a time.
        */}
        {!canSend && onStartRecording ? (
          <Pressable
            onPress={onStartRecording}
            disabled={disabled}
            aria-label="Record a voice message"
            className="w-target-md items-center justify-center rounded-control border-2 border-strong bg-surface-raised"
          >
            <Mic size={20} className="text-text" />
          </Pressable>
        ) : (
          /* `min-h-0` + the field's own padding tier: the size scale's `py-4`
             made the button 64px, and with `items-stretch` that dragged the
             field out of shape. Same padding on both keeps them level without
             either dictating a number. */
          <Button
            title="Send"
            variant="primary"
            size={size}
            className="h-auto min-h-0 self-stretch py-inset-field md:py-inset-field"
            disabled={!canSend}
            onPress={handleSubmit}
            aria-label="Send message"
          />
        )}
      </View>
    </View>
  );
}
